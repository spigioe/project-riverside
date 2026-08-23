using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using SupportPortal.Application.DTOs;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public partial class TicketEmailProcessor(
    AppDbContext db,
    ICsmService csmService,
    IContactService contactService,
    IFileStorageService fileStorageService,
    IOptions<MinioSettings> minioOptions,
    ISlaService slaService,
    ISlaCalculationService slaCalculationService,
    ILogger<TicketEmailProcessor> logger) : ITicketEmailProcessor
{
    [GeneratedRegex(@"\[#(\d+)\]")]
    private static partial Regex SubjectTicketIdRegex();

    public async Task ProcessAsync(IReadOnlyList<InboundEmail> emails)
    {
        foreach (var email in emails)
        {
            try
            {
                await ProcessOneAsync(email);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Hiba történt a(z) {MessageId} azonosítójú email feldolgozása közben.", email.MessageId);
            }
        }
    }

    private async Task ProcessOneAsync(InboundEmail email)
    {
        if (await db.EmailQueues.AnyAsync(q => q.ExternalMessageId == email.MessageId))
        {
            logger.LogInformation("A(z) {MessageId} azonosítójú email már fel lett dolgozva, kihagyva.", email.MessageId);
            return;
        }

        var fromAddress = MailboxAddress.TryParse(email.From, out var parsedFrom)
            ? parsedFrom
            : new MailboxAddress(email.From, email.From);

        var ticket = await FindMatchingTicketAsync(email);

        if (ticket is null)
        {
            var createdAt = DateTime.UtcNow;
            var defaultPriority = TicketPriority.Medium;
            var requesterName = string.IsNullOrWhiteSpace(fromAddress.Name) ? fromAddress.Address : fromAddress.Name;
            var contact = await contactService.UpsertAsync(fromAddress.Address, requesterName);
            ticket = new Ticket
            {
                Subject = StripTicketIdTag(email.Subject),
                Body = email.Body,
                Status = TicketStatus.New,
                Priority = defaultPriority,
                Source = TicketSource.Email,
                RequesterEmail = fromAddress.Address,
                RequesterName = requesterName,
                CsmId = await csmService.FindCsmIdForEmailAsync(fromAddress.Address),
                ContactId = contact.Id,
                CreatedAt = createdAt,
                SlaDueAt = await ComputeSlaDueAtAsync(fromAddress.Address, defaultPriority, createdAt),
            };
            db.Tickets.Add(ticket);
            await db.SaveChangesAsync();

            // Az induló email tartalma a ticket.Body-ban is landol, de emellett (a beszélgetés-szál
            // teljessége miatt, lásd TicketService.CreateTicketAsync ugyanezt teszi portál/API eredetű
            // ticketeknél) mindig létrejön egy kezdő bejövő TicketMessage is ugyanazzal a tartalommal —
            // ehhez kapcsolódnak a csatolmányok (ha vannak).
            var rawPartsJson = email.RawParts is { Count: > 0 }
                ? JsonSerializer.Serialize(email.RawParts.Select(p => new { from = p.From, body = p.Body, sentAt = p.SentAt }))
                : null;

            var initialMessage = new TicketMessage
            {
                TicketId = ticket.Id,
                SenderEmail = fromAddress.Address,
                Body = email.Body,
                Direction = MessageDirection.Inbound,
                RawEmailParts = rawPartsJson,
            };
            db.TicketMessages.Add(initialMessage);
            await db.SaveChangesAsync();

            if (email.Attachments.Count > 0)
                await UploadAttachmentsAsync(ticket.Id, initialMessage.Id, email.Attachments);
        }
        else
        {
            var rawPartsJson = email.RawParts is { Count: > 0 }
                ? JsonSerializer.Serialize(email.RawParts.Select(p => new { from = p.From, body = p.Body, sentAt = p.SentAt }))
                : null;

            var message = new TicketMessage
            {
                TicketId = ticket.Id,
                SenderEmail = fromAddress.Address,
                Body = email.Body,
                Direction = MessageDirection.Inbound,
                RawEmailParts = rawPartsJson,
            };
            db.TicketMessages.Add(message);
            await db.SaveChangesAsync();

            if (email.Attachments.Count > 0)
                await UploadAttachmentsAsync(ticket.Id, message.Id, email.Attachments);
        }

        db.EmailQueues.Add(new EmailQueue
        {
            TicketId = ticket.Id,
            FromAddress = fromAddress.Address,
            ToAddress = email.To,
            Subject = email.Subject,
            Body = email.Body,
            Status = EmailQueueStatus.Received,
            ExternalMessageId = email.MessageId,
            InReplyTo = email.InReplyTo,
            ReferencesHeader = email.References,
        });

        await db.SaveChangesAsync();
    }

    private async Task<Ticket?> FindMatchingTicketAsync(InboundEmail email)
    {
        // a) In-Reply-To
        if (!string.IsNullOrWhiteSpace(email.InReplyTo))
        {
            var ticket = await FindTicketByExternalMessageIdAsync(email.InReplyTo.Trim());
            if (ticket is not null) return ticket;
        }

        // b) References (több Message-ID, szóközzel elválasztva)
        if (!string.IsNullOrWhiteSpace(email.References))
        {
            foreach (var referencedId in email.References.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            {
                var ticket = await FindTicketByExternalMessageIdAsync(referencedId.Trim());
                if (ticket is not null) return ticket;
            }
        }

        // c) Subject [#ID]
        var match = SubjectTicketIdRegex().Match(email.Subject ?? string.Empty);
        if (match.Success && int.TryParse(match.Groups[1].Value, out var ticketId))
        {
            var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == ticketId);
            if (ticket is not null) return ticket;
        }

        return null;
    }

    private async Task<Ticket?> FindTicketByExternalMessageIdAsync(string messageId)
    {
        var queueEntry = await db.EmailQueues
            .Include(q => q.Ticket)
            .FirstOrDefaultAsync(q => q.ExternalMessageId == messageId);

        return queueEntry?.Ticket;
    }

    private static string StripTicketIdTag(string subject) =>
        SubjectTicketIdRegex().Replace(subject ?? string.Empty, string.Empty).Trim();

    // Ugyanaz a MinIO feltöltési minta, mint a kimenő csatolmányoknál (TicketService.AddMessageAsync),
    // csak IFormFile helyett a Mailpit-ről már letöltött byte[] tartalommal.
    private async Task UploadAttachmentsAsync(int ticketId, int messageId, IReadOnlyList<InboundEmailAttachment> attachments)
    {
        foreach (var attachment in attachments)
        {
            var fileName = Path.GetFileName(attachment.Filename);
            var objectKey = $"tickets/{ticketId}/{messageId}/{Guid.NewGuid()}-{fileName}";

            using (var stream = new MemoryStream(attachment.Data))
                await fileStorageService.UploadAsync(objectKey, stream, attachment.Data.Length, attachment.ContentType);

            db.FileStorages.Add(new FileStorage
            {
                MessageId = messageId,
                StorageBackend = StorageBackend.Minio,
                BucketOrPath = minioOptions.Value.Bucket,
                ObjectKey = objectKey,
                OriginalFilename = fileName,
                MimeType = string.IsNullOrWhiteSpace(attachment.ContentType) ? "application/octet-stream" : attachment.ContentType,
                FileSize = attachment.Data.Length,
            });
        }

        await db.SaveChangesAsync();
    }

    private async Task<DateTime?> ComputeSlaDueAtAsync(string requesterEmail, TicketPriority priority, DateTime createdAt)
    {
        var slaParams = await slaService.FindPolicyForTicketAsync(requesterEmail, priority);
        if (slaParams is null) return null;
        return await slaCalculationService.CalculateDueAtAsync(createdAt, slaParams.Value.ResponseTimeMinutes, slaParams.Value.BusinessHoursOnly);
    }
}
