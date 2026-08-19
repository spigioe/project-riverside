using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SupportPortal.Application.DTOs;
using SupportPortal.Application.DTOs.Common;
using SupportPortal.Application.DTOs.Tickets;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public class TicketService(
    AppDbContext db,
    IEmailService emailService,
    IOptions<MailSettings> mailOptions,
    INotificationService notificationService,
    ILogger<TicketService> logger) : ITicketService
{
    public async Task<PagedResult<TicketListItemDto>> GetTicketsAsync(TicketListQuery query)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 100 ? 20 : query.PageSize;

        var ticketsQuery = db.Tickets.AsNoTracking().AsQueryable();

        if (query.Status.HasValue)
            ticketsQuery = ticketsQuery.Where(t => t.Status == query.Status.Value);

        if (query.Priority.HasValue)
            ticketsQuery = ticketsQuery.Where(t => t.Priority == query.Priority.Value);

        if (query.CategoryId.HasValue)
            ticketsQuery = ticketsQuery.Where(t => t.CategoryId == query.CategoryId.Value);

        if (query.DateFrom.HasValue)
            ticketsQuery = ticketsQuery.Where(t => t.CreatedAt >= query.DateFrom.Value);

        if (query.DateTo.HasValue)
            ticketsQuery = ticketsQuery.Where(t => t.CreatedAt <= query.DateTo.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            ticketsQuery = ticketsQuery.Where(t =>
                t.Subject.Contains(search) ||
                t.RequesterEmail.Contains(search) ||
                t.RequesterName.Contains(search));
        }

        var totalCount = await ticketsQuery.CountAsync();

        var items = await ticketsQuery
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new TicketListItemDto(
                t.Id, t.Subject, t.Status, t.Priority,
                t.CategoryId, t.Category != null ? t.Category.Name : null,
                t.AssignedToId, t.AssignedTo != null ? t.AssignedTo.FullName : null,
                t.RequesterEmail, t.RequesterName,
                t.IsCsmFlagged, t.IsMerged,
                t.SlaDueAt, t.SlaBreach,
                t.CreatedAt, t.UpdatedAt))
            .ToListAsync();

        return new PagedResult<TicketListItemDto>(items, page, pageSize, totalCount);
    }

    public async Task<TicketDetailDto?> GetTicketByIdAsync(int id)
    {
        return await db.Tickets
            .AsNoTracking()
            .Where(t => t.Id == id)
            .Select(t => new TicketDetailDto(
                t.Id, t.Subject, t.Body, t.Status, t.Priority,
                t.CategoryId, t.Category != null ? t.Category.Name : null,
                t.AssignedToId, t.AssignedTo != null ? t.AssignedTo.FullName : null,
                t.CreatedById, t.CreatedBy != null ? t.CreatedBy.FullName : null,
                t.RequesterEmail, t.RequesterName, t.Source,
                t.IsCsmFlagged, t.IsMerged, t.MergedIntoTicketId,
                t.SlaDueAt, t.SlaBreach,
                t.CreatedAt, t.UpdatedAt))
            .FirstOrDefaultAsync();
    }

    public async Task<TicketDetailDto> CreateTicketAsync(CreateTicketRequest request, int currentUserId, TicketSource source = TicketSource.Manual)
    {
        var ticket = new Ticket
        {
            Subject = request.Subject,
            Body = request.Body,
            Status = TicketStatus.New,
            Priority = request.Priority,
            CategoryId = request.CategoryId,
            AssignedToId = request.AssignedToId,
            CreatedById = currentUserId,
            RequesterEmail = request.RequesterEmail,
            RequesterName = request.RequesterName,
            Source = source,
        };

        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        var activeUserIds = await db.Users
            .Where(u => u.IsActive && u.Id != currentUserId)
            .Select(u => u.Id)
            .ToListAsync();

        foreach (var userId in activeUserIds)
            await notificationService.SendAsync(userId, NotificationTrigger.NewTicket, ticket.Id, $"Új ticket érkezett: {ticket.Subject}");

        return (await GetTicketByIdAsync(ticket.Id))!;
    }

    public async Task<bool> UpdateTicketAsync(int id, UpdateTicketRequest request)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return false;

        ticket.Subject = request.Subject;
        ticket.Body = request.Body;
        ticket.Priority = request.Priority;
        ticket.CategoryId = request.CategoryId;
        ticket.RequesterEmail = request.RequesterEmail;
        ticket.RequesterName = request.RequesterName;
        ticket.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateStatusAsync(int id, TicketStatus status, int currentUserId)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return false;

        ticket.Status = status;
        ticket.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        if (ticket.AssignedToId.HasValue && ticket.AssignedToId.Value != currentUserId)
        {
            await notificationService.SendAsync(
                ticket.AssignedToId.Value, NotificationTrigger.StatusChanged, ticket.Id,
                $"Státusz változott (#{ticket.Id}): {ticket.Subject} → {status}");
        }

        return true;
    }

    public async Task<TicketAssignResult> AssignAsync(int id, int? assignedToId, int currentUserId)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return TicketAssignResult.TicketNotFound;

        if (assignedToId.HasValue)
        {
            var userExists = await db.Users.AnyAsync(u => u.Id == assignedToId.Value && u.IsActive);
            if (!userExists) return TicketAssignResult.UserNotFound;
        }

        ticket.AssignedToId = assignedToId;
        ticket.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        if (assignedToId.HasValue && assignedToId.Value != currentUserId)
        {
            await notificationService.SendAsync(
                assignedToId.Value, NotificationTrigger.Assigned, ticket.Id,
                $"Hozzád rendelve: #{ticket.Id} {ticket.Subject}");
        }

        return TicketAssignResult.Success;
    }

    public async Task<bool?> ToggleCsmAsync(int id, int currentUserId)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return null;

        ticket.IsCsmFlagged = !ticket.IsCsmFlagged;
        ticket.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        if (ticket.IsCsmFlagged)
        {
            var adminIds = await db.Users
                .Where(u => u.IsActive && u.Id != currentUserId &&
                    (u.Role.Name == UserRole.MasterAdmin || u.Role.Name == UserRole.Admin))
                .Select(u => u.Id)
                .ToListAsync();

            foreach (var userId in adminIds)
                await notificationService.SendAsync(userId, NotificationTrigger.CsmFlagged, ticket.Id, $"CSM jelölés: #{ticket.Id} {ticket.Subject}");
        }

        return ticket.IsCsmFlagged;
    }

    public async Task<TicketMergeResult> MergeAsync(int id, int targetTicketId)
    {
        if (id == targetTicketId) return TicketMergeResult.SelfMerge;

        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return TicketMergeResult.TicketNotFound;

        if (ticket.IsMerged) return TicketMergeResult.SourceAlreadyMerged;

        var target = await db.Tickets.FirstOrDefaultAsync(t => t.Id == targetTicketId);
        if (target is null) return TicketMergeResult.TargetNotFound;

        if (target.IsMerged) return TicketMergeResult.TargetAlreadyMerged;

        ticket.IsMerged = true;
        ticket.MergedIntoTicketId = targetTicketId;
        ticket.Status = TicketStatus.Closed;
        ticket.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return TicketMergeResult.Success;
    }

    public async Task<IReadOnlyList<TicketMessageDto>?> GetMessagesAsync(int ticketId)
    {
        var ticketExists = await db.Tickets.AnyAsync(t => t.Id == ticketId);
        if (!ticketExists) return null;

        return await db.TicketMessages
            .AsNoTracking()
            .Where(m => m.TicketId == ticketId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new TicketMessageDto(
                m.Id, m.TicketId,
                m.SenderUserId, m.SenderUser != null ? m.SenderUser.FullName : null,
                m.SenderEmail, m.Body, m.IsInternalNote, m.Direction, m.CreatedAt))
            .ToListAsync();
    }

    public async Task<TicketMessageDto?> AddMessageAsync(int ticketId, CreateTicketMessageRequest request, int currentUserId)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == ticketId);
        if (ticket is null) return null;

        var message = new TicketMessage
        {
            TicketId = ticketId,
            SenderUserId = currentUserId,
            Body = request.Body,
            IsInternalNote = request.IsInternalNote,
            Direction = MessageDirection.Outbound,
        };

        db.TicketMessages.Add(message);
        await db.SaveChangesAsync();

        if (!request.IsInternalNote)
            await SendReplyEmailAsync(ticket, request.Body);

        var recipientIds = new HashSet<int>();
        if (ticket.AssignedToId.HasValue) recipientIds.Add(ticket.AssignedToId.Value);
        if (ticket.CreatedById.HasValue) recipientIds.Add(ticket.CreatedById.Value);
        recipientIds.Remove(currentUserId);

        foreach (var userId in recipientIds)
        {
            await notificationService.SendAsync(
                userId, NotificationTrigger.NewMessage, ticket.Id,
                $"Új üzenet érkezett a(z) #{ticket.Id} jegyhez: {ticket.Subject}");
        }

        return await db.TicketMessages
            .AsNoTracking()
            .Where(m => m.Id == message.Id)
            .Select(m => new TicketMessageDto(
                m.Id, m.TicketId,
                m.SenderUserId, m.SenderUser != null ? m.SenderUser.FullName : null,
                m.SenderEmail, m.Body, m.IsInternalNote, m.Direction, m.CreatedAt))
            .FirstAsync();
    }

    private async Task SendReplyEmailAsync(Ticket ticket, string body)
    {
        // Az eredeti (legkorábbi) bejövő email erre a jegyre — ennek Message-ID-jére válaszolunk,
        // hogy a levelezőkliens/Mailpit egy szálban tartsa a beszélgetést.
        var original = await db.EmailQueues
            .Where(q => q.TicketId == ticket.Id && q.ExternalMessageId != null)
            .OrderBy(q => q.CreatedAt)
            .FirstOrDefaultAsync();

        var subject = $"Re: [#{ticket.Id}] {ticket.Subject}";

        try
        {
            var messageId = await emailService.SendAsync(
                ticket.RequesterEmail, subject, body, original?.ExternalMessageId, original?.ExternalMessageId);

            db.EmailQueues.Add(new EmailQueue
            {
                TicketId = ticket.Id,
                FromAddress = mailOptions.Value.FromAddress,
                ToAddress = ticket.RequesterEmail,
                Subject = subject,
                Body = body,
                Status = EmailQueueStatus.Sent,
                ExternalMessageId = messageId,
                InReplyTo = original?.ExternalMessageId,
                ReferencesHeader = original?.ExternalMessageId,
                SentAt = DateTime.UtcNow,
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Nem sikerült elküldeni a válaszemailt a(z) {TicketId} jegyhez.", ticket.Id);

            db.EmailQueues.Add(new EmailQueue
            {
                TicketId = ticket.Id,
                FromAddress = mailOptions.Value.FromAddress,
                ToAddress = ticket.RequesterEmail,
                Subject = subject,
                Body = body,
                Status = EmailQueueStatus.Failed,
                InReplyTo = original?.ExternalMessageId,
                ReferencesHeader = original?.ExternalMessageId,
            });
        }

        await db.SaveChangesAsync();
    }
}
