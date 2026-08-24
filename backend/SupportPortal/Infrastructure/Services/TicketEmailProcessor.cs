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
    IOptions<MailSettings> mailOptions,
    ISlaService slaService,
    ISlaCalculationService slaCalculationService,
    IEmailService emailService,
    ITemplateService templateService,
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
        var isNewTicket = ticket is null;

        var inlineImages = email.Attachments.Where(a => a.IsInline && a.ContentId is not null).ToList();
        var regularAttachments = email.Attachments.Where(a => !a.IsInline).ToList();

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

            if (inlineImages.Count > 0)
            {
                var resolvedBody = await ReplaceInlineImagesAsync(ticket.Id, initialMessage.Id, email.Body, inlineImages);
                if (resolvedBody != email.Body)
                {
                    initialMessage.Body = resolvedBody;
                    ticket.Body = resolvedBody;
                    await db.SaveChangesAsync();
                }
            }

            if (regularAttachments.Count > 0)
                await UploadAttachmentsAsync(ticket.Id, initialMessage.Id, regularAttachments);
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

            if (inlineImages.Count > 0)
            {
                var resolvedBody = await ReplaceInlineImagesAsync(ticket.Id, message.Id, email.Body, inlineImages);
                if (resolvedBody != email.Body)
                {
                    message.Body = resolvedBody;
                    await db.SaveChangesAsync();
                }
            }

            if (regularAttachments.Count > 0)
                await UploadAttachmentsAsync(ticket.Id, message.Id, regularAttachments);
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

        if (isNewTicket)
            await TrySendAutoResponderAsync(ticket, fromAddress.Address);
    }

    private async Task TrySendAutoResponderAsync(Ticket ticket, string toEmail)
    {
        var template = await db.AutoResponderTemplates
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Trigger == "new_ticket" && t.IsEnabled);

        if (template is null) return;

        var contact = ticket.ContactId.HasValue
            ? await db.Contacts.AsNoTracking().Include(c => c.Company).FirstOrDefaultAsync(c => c.Id == ticket.ContactId.Value)
            : null;

        var context = new TemplateContext(
            TicketId: ticket.Id,
            TicketSubject: ticket.Subject,
            TicketStatus: ticket.Status.ToString(),
            TicketPriority: ticket.Priority.ToString(),
            TicketCreatedAt: ticket.CreatedAt.ToLocalTime().ToString("yyyy. MM. dd. HH:mm"),
            ContactName: contact?.Name ?? ticket.RequesterName,
            ContactEmail: toEmail,
            ContactCompany: contact?.Company?.Name,
            AgentName: null,
            AgentEmail: null,
            PortalUrl: mailOptions.Value.PortalUrl);

        var subject = templateService.Render(template.SubjectTemplate, context);
        var body = templateService.Render(template.BodyTemplate, context);

        try
        {
            await emailService.SendAsync(toEmail, subject, body, null, null);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Nem sikerült az auto-responder emailt küldeni a(z) {TicketId} jegyhez.", ticket.Id);
        }
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

    // Bejövő inline képek feltöltése MinIO-ba + cid: hivatkozások URL-re cserélése a body-ban.
    // A messageId-t az URL-ben kell megadni, ezért a message mentése után hívjuk.
    private async Task<string> ReplaceInlineImagesAsync(int ticketId, int messageId, string body,
        IEnumerable<InboundEmailAttachment> inlineImages)
    {
        foreach (var img in inlineImages)
        {
            var contentId = img.ContentId!;
            var fileName = Path.GetFileName(img.Filename);
            var objectKey = $"tickets/{ticketId}/{messageId}/inline-{Guid.NewGuid()}-{fileName}";

            using (var stream = new MemoryStream(img.Data))
                await fileStorageService.UploadAsync(objectKey, stream, img.Data.Length, img.ContentType);

            var fileStorage = new FileStorage
            {
                MessageId = messageId,
                TicketId = ticketId,
                StorageBackend = StorageBackend.Minio,
                BucketOrPath = minioOptions.Value.Bucket,
                ObjectKey = objectKey,
                OriginalFilename = fileName,
                MimeType = img.ContentType,
                FileSize = img.Data.Length,
                IsInline = true,
                ContentId = contentId,
            };
            db.FileStorages.Add(fileStorage);
            await db.SaveChangesAsync();

            var downloadUrl = $"/api/portal/attachments/{fileStorage.Id}/download";
            body = body
                .Replace($"cid:{contentId}", downloadUrl)
                .Replace($"cid:&lt;{contentId}&gt;", downloadUrl);
        }

        return body;
    }

    private async Task UploadAttachmentsAsync(int ticketId, int messageId, IReadOnlyList<InboundEmailAttachment> attachments)
    {
        foreach (var attachment in attachments.Where(a => !a.IsInline))
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
