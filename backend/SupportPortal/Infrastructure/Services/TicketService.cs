using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Common;
using SupportPortal.Application.DTOs.Tickets;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public class TicketService(AppDbContext db) : ITicketService
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

    public async Task<TicketDetailDto> CreateTicketAsync(CreateTicketRequest request, int currentUserId)
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
            Source = TicketSource.Manual,
        };

        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

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

    public async Task<bool> UpdateStatusAsync(int id, TicketStatus status)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return false;

        ticket.Status = status;
        ticket.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return true;
    }

    public async Task<TicketAssignResult> AssignAsync(int id, int? assignedToId)
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
        return TicketAssignResult.Success;
    }

    public async Task<bool?> ToggleCsmAsync(int id)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null) return null;

        ticket.IsCsmFlagged = !ticket.IsCsmFlagged;
        ticket.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
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
}
