using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MimeKit;
using SupportPortal.Application.DTOs;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public partial class TicketEmailProcessor(AppDbContext db, ICsmService csmService, ILogger<TicketEmailProcessor> logger) : ITicketEmailProcessor
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
            ticket = new Ticket
            {
                Subject = StripTicketIdTag(email.Subject),
                Body = email.Body,
                Status = TicketStatus.New,
                Source = TicketSource.Email,
                RequesterEmail = fromAddress.Address,
                RequesterName = string.IsNullOrWhiteSpace(fromAddress.Name) ? fromAddress.Address : fromAddress.Name,
                CsmId = await csmService.FindCsmIdForEmailAsync(fromAddress.Address),
            };
            db.Tickets.Add(ticket);
            await db.SaveChangesAsync();
        }
        else
        {
            db.TicketMessages.Add(new TicketMessage
            {
                TicketId = ticket.Id,
                SenderEmail = fromAddress.Address,
                Body = email.Body,
                Direction = MessageDirection.Inbound,
            });
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
}
