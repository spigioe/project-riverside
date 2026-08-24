using Microsoft.AspNetCore.Http;
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
    IOptions<MinioSettings> minioOptions,
    INotificationService notificationService,
    ICsmService csmService,
    IContactService contactService,
    IFileStorageService fileStorageService,
    IAuditLogService auditLogService,
    ISlaService slaService,
    ISlaCalculationService slaCalculationService,
    ILogger<TicketService> logger) : ITicketService
{
    public async Task<PagedResult<TicketListItemDto>> GetTicketsAsync(TicketListQuery query)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 100 ? 20 : query.PageSize;

        // ShowDeleted=true → global query filtert (IsDeleted) megkerüljük, csak törölteket mutatjuk
        var ticketsQuery = query.ShowDeleted
            ? db.Tickets.AsNoTracking().IgnoreQueryFilters().Where(t => t.IsDeleted)
            : db.Tickets.AsNoTracking().AsQueryable();

        if (!query.ShowDeleted)
        {
            if (query.Status.HasValue)
                ticketsQuery = ticketsQuery.Where(t => t.Status == query.Status.Value);
            else if (!query.IncludeClosed)
                ticketsQuery = ticketsQuery.Where(t => t.Status != TicketStatus.Closed && t.Status != TicketStatus.Resolved);
        }

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

        if (query.AssignedToId.HasValue)
            ticketsQuery = ticketsQuery.Where(t => t.AssignedToId == query.AssignedToId.Value);

        if (query.Source.HasValue)
            ticketsQuery = ticketsQuery.Where(t => t.Source == query.Source.Value);

        if (query.ContactId.HasValue)
            ticketsQuery = ticketsQuery.Where(t => t.ContactId == query.ContactId.Value);

        if (query.CompanyId.HasValue)
            ticketsQuery = ticketsQuery.Where(t => t.Contact != null && t.Contact.CompanyId == query.CompanyId.Value);

        var totalCount = await ticketsQuery.CountAsync();

        var rows = await ticketsQuery
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id, t.Subject, t.Status, t.Priority, t.Source, t.Type,
                t.CategoryId, CategoryName = t.Category != null ? t.Category.Name : null,
                t.AssignedToId, AssignedToName = t.AssignedTo != null ? t.AssignedTo.FullName : null,
                t.RequesterEmail, t.RequesterName,
                t.IsCsmFlagged, t.IsMerged,
                t.SlaDueAt, t.SlaBreach,
                t.CreatedAt, t.UpdatedAt,
                t.CustomStatusKey,
                LastMessageBody = t.Messages.OrderByDescending(m => m.CreatedAt).Select(m => m.Body).FirstOrDefault(),
                LastMessageAt = t.Messages.OrderByDescending(m => m.CreatedAt).Select(m => (DateTime?)m.CreatedAt).FirstOrDefault(),
            })
            .ToListAsync();

        // A cégnév (email domain) kliens oldalon (memóriában) számolt, nem az adatbázis-lekérdezésben —
        // egyszerű string-művelet, nincs értelme SQL-be tolni.
        var items = rows
            .Select(r => new TicketListItemDto(
                r.Id, r.Subject, r.Status, r.Priority,
                r.CategoryId, r.CategoryName,
                r.AssignedToId, r.AssignedToName,
                r.RequesterEmail, r.RequesterName, ExtractCompanyFromEmail(r.RequesterEmail),
                r.IsCsmFlagged, r.IsMerged,
                r.SlaDueAt, r.SlaBreach,
                r.LastMessageBody, r.LastMessageAt,
                r.CreatedAt, r.UpdatedAt, r.Source, r.Type,
                r.CustomStatusKey))
            .ToList();

        return new PagedResult<TicketListItemDto>(items, page, pageSize, totalCount);
    }

    public async Task<TicketDetailDto?> GetTicketByIdAsync(int id)
    {
        return await db.Tickets
            .AsNoTracking()
            .Where(t => t.Id == id)
            .Select(t => new TicketDetailDto(
                t.Id, t.Subject, t.Body, t.Status, t.Priority, t.Type,
                t.CategoryId, t.Category != null ? t.Category.Name : null,
                t.AssignedToId, t.AssignedTo != null ? t.AssignedTo.FullName : null,
                t.CreatedById, t.CreatedBy != null ? t.CreatedBy.FullName : null,
                t.RequesterEmail, t.RequesterName, t.Source,
                t.IsCsmFlagged, t.CsmId, t.Csm != null ? t.Csm.Name : null,
                t.IsMerged, t.MergedIntoTicketId,
                t.SlaDueAt, t.SlaBreach,
                t.CreatedAt, t.UpdatedAt,
                t.ContactId,
                t.Contact != null ? t.Contact.Name : null,
                t.Contact != null ? t.Contact.CompanyId : null,
                t.Contact != null && t.Contact.Company != null ? t.Contact.Company.Name : null,
                t.CustomStatusKey))
            .FirstOrDefaultAsync();
    }

    public async Task<TicketDetailDto> CreateTicketAsync(CreateTicketRequest request, int currentUserId, TicketSource source = TicketSource.Manual)
    {
        var createdAt = DateTime.UtcNow;
        var contact = await contactService.UpsertAsync(request.RequesterEmail, request.RequesterName);
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
            CsmId = await csmService.FindCsmIdForEmailAsync(request.RequesterEmail),
            ContactId = contact.Id,
            CreatedAt = createdAt,
            SlaDueAt = await ComputeSlaDueAtAsync(request.RequesterEmail, request.Priority, createdAt),
        };

        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        // A ticket törzse (Body) a kérelmező eredeti üzenete — ennek is meg kell jelennie a
        // beszélgetés-szálban (MessageThread), nem csak a ticket metaadataiban, ezért egy kezdő
        // bejövő TicketMessage is létrejön ugyanazzal a tartalommal (lásd TicketEmailProcessor
        // ugyanezt teszi email eredetű ticketeknél).
        db.TicketMessages.Add(new TicketMessage
        {
            TicketId = ticket.Id,
            SenderEmail = ticket.RequesterEmail,
            Body = ticket.Body,
            Direction = MessageDirection.Inbound,
        });
        await db.SaveChangesAsync();

        await auditLogService.LogAsync(currentUserId, "ticket", ticket.Id, "created", null, null);

        var activeUserIds = await db.Users
            .Where(u => u.IsActive && u.Id != currentUserId)
            .Select(u => u.Id)
            .ToListAsync();

        foreach (var userId in activeUserIds)
            await notificationService.SendAsync(userId, NotificationTrigger.NewTicket, ticket.Id, $"Új ticket érkezett: {ticket.Subject}");

        return (await GetTicketByIdAsync(ticket.Id))!;
    }

    public async Task<bool> UpdateTicketAsync(int id, UpdateTicketRequest request, int currentUserId)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return false;

        var oldPriority = ticket.Priority;
        var oldCategoryId = ticket.CategoryId;

        ticket.Subject = request.Subject;
        ticket.Body = request.Body;
        ticket.Priority = request.Priority;
        ticket.CategoryId = request.CategoryId;
        ticket.RequesterEmail = request.RequesterEmail;
        ticket.RequesterName = request.RequesterName;
        ticket.UpdatedAt = DateTime.UtcNow;

        if (oldPriority != request.Priority)
            ticket.SlaDueAt = await ComputeSlaDueAtAsync(request.RequesterEmail, request.Priority, ticket.CreatedAt);

        await db.SaveChangesAsync();

        if (oldPriority != request.Priority)
        {
            await auditLogService.LogAsync(
                currentUserId, "ticket", id, "priority_changed", oldPriority.ToString(), request.Priority.ToString());
        }

        if (oldCategoryId != request.CategoryId)
        {
            var oldCategoryName = oldCategoryId.HasValue
                ? await db.TicketCategories.Where(c => c.Id == oldCategoryId).Select(c => c.Name).FirstOrDefaultAsync()
                : null;
            var newCategoryName = request.CategoryId.HasValue
                ? await db.TicketCategories.Where(c => c.Id == request.CategoryId).Select(c => c.Name).FirstOrDefaultAsync()
                : null;
            await auditLogService.LogAsync(currentUserId, "ticket", id, "category_changed", oldCategoryName, newCategoryName);
        }

        return true;
    }

    public async Task<bool> UpdateStatusAsync(int id, TicketStatus status, int currentUserId)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return false;

        var oldStatus = ticket.Status;
        ticket.Status = status;
        ticket.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        if (oldStatus != status)
            await auditLogService.LogAsync(currentUserId, "ticket", id, "status_changed", oldStatus.ToString(), status.ToString());

        if (ticket.AssignedToId.HasValue && ticket.AssignedToId.Value != currentUserId)
        {
            await notificationService.SendAsync(
                ticket.AssignedToId.Value, NotificationTrigger.StatusChanged, ticket.Id,
                $"Státusz változott (#{ticket.Id}): {ticket.Subject} → {status}");
        }

        return true;
    }

    public async Task<bool> UpdatePriorityAsync(int id, TicketPriority priority, int currentUserId)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return false;

        var oldPriority = ticket.Priority;
        ticket.Priority = priority;
        ticket.UpdatedAt = DateTime.UtcNow;

        if (oldPriority != priority)
            ticket.SlaDueAt = await ComputeSlaDueAtAsync(ticket.RequesterEmail, priority, ticket.CreatedAt);

        await db.SaveChangesAsync();

        if (oldPriority != priority)
            await auditLogService.LogAsync(currentUserId, "ticket", id, "priority_changed", oldPriority.ToString(), priority.ToString());

        return true;
    }

    public async Task<bool> UpdateTypeAsync(int id, string? type, int currentUserId)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return false;

        var oldType = ticket.Type ?? "null";
        ticket.Type = type;
        ticket.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await auditLogService.LogAsync(currentUserId, "ticket", id, "type_changed", oldType, type ?? "null");

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

        var oldAssignedToId = ticket.AssignedToId;
        ticket.AssignedToId = assignedToId;
        ticket.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        if (oldAssignedToId != assignedToId)
        {
            var oldName = oldAssignedToId.HasValue
                ? await db.Users.Where(u => u.Id == oldAssignedToId).Select(u => u.FullName).FirstOrDefaultAsync()
                : null;
            var newName = assignedToId.HasValue
                ? await db.Users.Where(u => u.Id == assignedToId).Select(u => u.FullName).FirstOrDefaultAsync()
                : null;
            await auditLogService.LogAsync(currentUserId, "ticket", id, "assigned", oldName, newName);
        }

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

        var oldFlagged = ticket.IsCsmFlagged;
        ticket.IsCsmFlagged = !ticket.IsCsmFlagged;
        ticket.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        await auditLogService.LogAsync(
            currentUserId, "ticket", id, "csm_flagged", oldFlagged.ToString(), ticket.IsCsmFlagged.ToString());

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

    public async Task<TicketCsmAssignResult> AssignCsmAsync(int id, int? csmId, int currentUserId)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return TicketCsmAssignResult.TicketNotFound;

        if (csmId.HasValue)
        {
            var csmExists = await db.CsmManagers.AnyAsync(c => c.Id == csmId.Value);
            if (!csmExists) return TicketCsmAssignResult.CsmNotFound;
        }

        var oldCsmId = ticket.CsmId;
        ticket.CsmId = csmId;
        ticket.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        if (oldCsmId != csmId)
        {
            var oldName = oldCsmId.HasValue
                ? await db.CsmManagers.Where(c => c.Id == oldCsmId).Select(c => c.Name).FirstOrDefaultAsync()
                : null;
            var newName = csmId.HasValue
                ? await db.CsmManagers.Where(c => c.Id == csmId).Select(c => c.Name).FirstOrDefaultAsync()
                : null;
            await auditLogService.LogAsync(currentUserId, "ticket", id, "csm_assigned", oldName, newName);
        }

        return TicketCsmAssignResult.Success;
    }

    public async Task<TicketMergeResult> MergeAsync(int id, int targetTicketId, int currentUserId)
    {
        if (id == targetTicketId) return TicketMergeResult.SelfMerge;

        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return TicketMergeResult.TicketNotFound;

        if (ticket.IsMerged) return TicketMergeResult.SourceAlreadyMerged;

        var target = await db.Tickets.FirstOrDefaultAsync(t => t.Id == targetTicketId);
        if (target is null) return TicketMergeResult.TargetNotFound;

        if (target.IsMerged) return TicketMergeResult.TargetAlreadyMerged;

        // Freshdesk-stílusú merge: a forrás összes üzenete átkerül a target ticket_id-jára — a
        // FileStorage sorok a MessageId-n keresztül kapcsolódnak, nem a TicketId-n, tehát a
        // csatolmányok automatikusan "átkerülnek" a message-ekkel együtt, külön migrálás nélkül.
        // A CreatedAt nem változik, ezért a target szálában időrendben, a többi üzenet közé
        // interleave-elve jelennek meg.
        // SourceTicketId csak akkor kerül beállításra, ha még nincs (null) — ha az üzenet egy
        // korábbi merge során már migrált (pl. C→A, majd most A→B), az EREDETI forrás (C) marad
        // megjelölve, nem a köztes ticket (A).
        var messagesToMove = await db.TicketMessages.Where(m => m.TicketId == id).ToListAsync();
        foreach (var message in messagesToMove)
        {
            message.SourceTicketId ??= id;
            message.TicketId = targetTicketId;
        }

        ticket.IsMerged = true;
        ticket.MergedIntoTicketId = targetTicketId;
        ticket.Status = TicketStatus.Closed;
        ticket.UpdatedAt = DateTime.UtcNow;
        target.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        var mergeDescription = $"Összevonva #{id} → #{targetTicketId}";
        await auditLogService.LogAsync(currentUserId, "ticket", id, "merged", null, mergeDescription);
        await auditLogService.LogAsync(currentUserId, "ticket", targetTicketId, "merged", null, mergeDescription);

        if (target.AssignedToId.HasValue && target.AssignedToId.Value != currentUserId)
        {
            await notificationService.SendAsync(
                target.AssignedToId.Value, NotificationTrigger.NewMessage, targetTicketId,
                $"Ticket #{id} összevonásra került ebbe a jegybe");
        }

        return TicketMergeResult.Success;
    }

    public async Task<IReadOnlyList<TicketSearchResultDto>> SearchAsync(string? q, int limit)
    {
        if (string.IsNullOrWhiteSpace(q)) return [];

        var effectiveLimit = limit is < 1 or > 50 ? 10 : limit;
        var search = q.Trim();

        var query = db.Tickets.AsNoTracking().Where(t => !t.IsMerged);

        query = int.TryParse(search, out var ticketId)
            ? query.Where(t => t.Id == ticketId || t.Subject.Contains(search) || t.RequesterEmail.Contains(search))
            : query.Where(t => t.Subject.Contains(search) || t.RequesterEmail.Contains(search));

        return await query
            .OrderByDescending(t => t.CreatedAt)
            .Take(effectiveLimit)
            .Select(t => new TicketSearchResultDto(t.Id, t.Subject, t.Status, t.RequesterEmail))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<TicketRelatedDto>?> GetRelatedAsync(int id)
    {
        var ticket = await db.Tickets.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return null;

        return await db.Tickets
            .AsNoTracking()
            .Where(t => t.RequesterEmail == ticket.RequesterEmail && t.Id != id && !t.IsMerged)
            .OrderByDescending(t => t.CreatedAt)
            .Take(5)
            .Select(t => new TicketRelatedDto(t.Id, t.Subject, t.Status, t.Priority, t.CreatedAt))
            .ToListAsync();
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
                m.Id, m.TicketId, m.SourceTicketId,
                m.SenderUserId, m.SenderUser != null ? m.SenderUser.FullName : null,
                m.SenderEmail, m.Body, m.Cc, m.Bcc, m.IsInternalNote, m.Direction, m.CreatedAt,
                m.RawEmailParts))
            .ToListAsync();
    }

    public async Task<TicketMessageDto?> AddMessageAsync(
        int ticketId, CreateTicketMessageRequest request, int currentUserId, IReadOnlyList<IFormFile>? attachments = null)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == ticketId);
        if (ticket is null) return null;

        var message = new TicketMessage
        {
            TicketId = ticketId,
            SenderUserId = currentUserId,
            Body = request.Body,
            Cc = request.Cc,
            Bcc = request.Bcc,
            IsInternalNote = request.IsInternalNote,
            Direction = MessageDirection.Outbound,
        };

        db.TicketMessages.Add(message);
        await db.SaveChangesAsync();

        if (attachments is { Count: > 0 })
        {
            foreach (var file in attachments)
            {
                var objectKey = $"tickets/{ticketId}/{message.Id}/{Guid.NewGuid()}-{Path.GetFileName(file.FileName)}";

                await using (var stream = file.OpenReadStream())
                    await fileStorageService.UploadAsync(objectKey, stream, file.Length, file.ContentType);

                db.FileStorages.Add(new FileStorage
                {
                    MessageId = message.Id,
                    StorageBackend = StorageBackend.Minio,
                    BucketOrPath = minioOptions.Value.Bucket,
                    ObjectKey = objectKey,
                    OriginalFilename = file.FileName,
                    MimeType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                    FileSize = file.Length,
                });
            }

            await db.SaveChangesAsync();
        }

        await auditLogService.LogAsync(
            currentUserId, "ticket", ticketId, "message_sent", null, request.IsInternalNote ? "internal_note" : "outbound");

        if (!request.IsInternalNote)
            await SendReplyEmailAsync(ticket, request.Body, request.Cc, request.Bcc);

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
                m.Id, m.TicketId, m.SourceTicketId,
                m.SenderUserId, m.SenderUser != null ? m.SenderUser.FullName : null,
                m.SenderEmail, m.Body, m.Cc, m.Bcc, m.IsInternalNote, m.Direction, m.CreatedAt,
                m.RawEmailParts))
            .FirstAsync();
    }

    public async Task<IReadOnlyList<TicketActivityDto>?> GetActivityAsync(int ticketId)
    {
        var ticketExists = await db.Tickets.AnyAsync(t => t.Id == ticketId);
        if (!ticketExists) return null;

        return await db.AuditLogs
            .AsNoTracking()
            .Where(a => a.EntityType == "ticket" && a.EntityId == ticketId)
            .OrderByDescending(a => a.CreatedAt)
            .Take(50)
            .Select(a => new TicketActivityDto(
                a.Id, a.UserId, a.User != null ? a.User.FullName : null, a.Action, a.OldValue, a.NewValue, a.CreatedAt))
            .ToListAsync();
    }

    public async Task<bool?> AssignContactAsync(int id, int? contactId, int currentUserId)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return null;

        if (contactId.HasValue && !await db.Contacts.AnyAsync(c => c.Id == contactId.Value))
            return false;

        ticket.ContactId = contactId;
        ticket.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        await auditLogService.LogAsync(currentUserId, "ticket", id, "contact_assigned",
            ticket.ContactId?.ToString(), contactId?.ToString());

        return true;
    }

    public async Task<bool?> AssignCustomStatusAsync(int id, string? key, int currentUserId)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return null;

        var oldKey = ticket.CustomStatusKey;
        ticket.CustomStatusKey = key;
        ticket.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        await auditLogService.LogAsync(currentUserId, "ticket", id, "custom_status_changed",
            oldKey, key);

        return true;
    }

    public async Task<bool> DeleteTicketAsync(int id, int currentUserId)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return false;

        ticket.IsDeleted = true;
        ticket.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        await auditLogService.LogAsync(currentUserId, "ticket", id, "deleted", null, null);

        return true;
    }

    private static string ExtractCompanyFromEmail(string email)
    {
        var idx = email.LastIndexOf('@');
        return idx >= 0 && idx < email.Length - 1 ? email[(idx + 1)..] : email;
    }

    private async Task SendReplyEmailAsync(Ticket ticket, string body, string? cc, string? bcc)
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
                ticket.RequesterEmail, subject, body, original?.ExternalMessageId, original?.ExternalMessageId, cc, bcc);

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

    private async Task<DateTime?> ComputeSlaDueAtAsync(string requesterEmail, TicketPriority priority, DateTime createdAt)
    {
        var slaParams = await slaService.FindPolicyForTicketAsync(requesterEmail, priority);
        if (slaParams is null) return null;
        return await slaCalculationService.CalculateDueAtAsync(createdAt, slaParams.Value.ResponseTimeMinutes, slaParams.Value.BusinessHoursOnly);
    }
}
