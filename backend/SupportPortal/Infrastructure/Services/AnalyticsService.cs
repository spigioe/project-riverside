using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Analytics;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Enums;
using MessageDirection = SupportPortal.Domain.Enums.MessageDirection;

namespace SupportPortal.Infrastructure.Services;

public class AnalyticsService(AppDbContext db) : IAnalyticsService
{
    public async Task<IReadOnlyList<TicketsByCategoryDto>> GetTicketsByCategoryAsync(AnalyticsPeriodQuery query)
    {
        var ticketsQuery = ApplyPeriod(db.Tickets.AsNoTracking(), query);

        // A Pomelo MySQL provider nem tudja lefordítani, ha a GroupBy utáni Select közvetlenül egy
        // record konstruktorát hívja aggregátummal (g.Count()) — anonim típusra vetítünk, és csak
        // az adatbázis-lekérdezés után, memóriában alakítjuk DTO-vá.
        var grouped = await ticketsQuery
            .GroupBy(t => t.CategoryId)
            .Select(g => new { CategoryId = g.Key, Count = g.Count() })
            .ToListAsync();

        var categoryNames = await db.TicketCategories.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);

        return grouped
            .Select(g => new TicketsByCategoryDto(
                g.CategoryId,
                g.CategoryId.HasValue && categoryNames.TryGetValue(g.CategoryId.Value, out var name) ? name : "Nincs kategória",
                g.Count))
            .OrderByDescending(x => x.Count)
            .ToList();
    }

    public async Task<IReadOnlyList<TicketsByStatusDto>> GetTicketsByStatusAsync(AnalyticsPeriodQuery query)
    {
        var ticketsQuery = ApplyPeriod(db.Tickets.AsNoTracking(), query);

        var grouped = await ticketsQuery
            .GroupBy(t => t.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        return grouped
            .Select(g => new TicketsByStatusDto(g.Status, g.Count))
            .OrderBy(x => x.Status)
            .ToList();
    }

    public async Task<SlaComplianceDto> GetSlaComplianceAsync(AnalyticsPeriodQuery query)
    {
        var ticketsQuery = ApplyPeriod(db.Tickets.AsNoTracking(), query)
            .Where(t => t.SlaDueAt != null);

        var total = await ticketsQuery.CountAsync();
        var breached = await ticketsQuery.CountAsync(t => t.SlaBreach);
        var compliant = total - breached;
        var percentage = total == 0 ? 0 : Math.Round(compliant / (double)total * 100, 1);

        return new SlaComplianceDto(total, compliant, breached, percentage);
    }

    public async Task<IReadOnlyList<RecentActivityItemDto>> GetRecentActivityAsync(int limit)
    {
        limit = limit is < 1 or > 100 ? 20 : limit;

        var recentTickets = await db.Tickets
            .AsNoTracking()
            .OrderByDescending(t => t.CreatedAt)
            .Take(limit)
            .Select(t => new RecentActivityItemDto(
                "TicketCreated", t.Id, t.Subject,
                t.CreatedBy != null ? t.CreatedBy.FullName : t.RequesterName,
                $"Új jegy létrehozva: {t.Subject}", t.CreatedAt))
            .ToListAsync();

        var recentMessages = await db.TicketMessages
            .AsNoTracking()
            .OrderByDescending(m => m.CreatedAt)
            .Take(limit)
            .Select(m => new RecentActivityItemDto(
                m.IsInternalNote ? "InternalNoteAdded" : "MessageAdded",
                m.TicketId, m.Ticket.Subject,
                m.SenderUser != null ? m.SenderUser.FullName : m.SenderEmail,
                m.IsInternalNote ? $"Belső megjegyzés hozzáadva (#{m.TicketId})" : $"Új üzenet a(z) #{m.TicketId} jegyben",
                m.CreatedAt))
            .ToListAsync();

        return recentTickets
            .Concat(recentMessages)
            .OrderByDescending(a => a.OccurredAt)
            .Take(limit)
            .ToList();
    }

    public async Task<ResponseTimesDto> GetResponseTimesAsync(AnalyticsQuery query, int? userId)
    {
        var ticketsQuery = ApplyAnalyticsQuery(db.Tickets.AsNoTracking(), query, userId);
        var tickets = await ticketsQuery
            .Select(t => new { t.Id, t.CreatedAt, t.Status, t.UpdatedAt })
            .ToListAsync();

        if (tickets.Count == 0)
            return new ResponseTimesDto(0, 0, 0, 0, query.Scope ?? "all");

        var ticketIds = tickets.Select(t => t.Id).ToList();

        var messages = await db.TicketMessages.AsNoTracking()
            .Where(m => ticketIds.Contains(m.TicketId) && !m.IsInternalNote)
            .OrderBy(m => m.TicketId).ThenBy(m => m.CreatedAt)
            .Select(m => new { m.TicketId, m.Direction, m.SenderUserId, m.CreatedAt })
            .ToListAsync();

        var messagesByTicket = messages.GroupBy(m => m.TicketId).ToDictionary(g => g.Key, g => g.ToList());

        var firstResponseMinutes = new List<double>();
        var resolutionMinutes = new List<double>();
        var responseMinutes = new List<double>();

        foreach (var ticket in tickets)
        {
            if (ticket.Status == TicketStatus.Resolved || ticket.Status == TicketStatus.Closed)
                resolutionMinutes.Add((ticket.UpdatedAt - ticket.CreatedAt).TotalMinutes);

            if (!messagesByTicket.TryGetValue(ticket.Id, out var msgs))
                continue;

            var firstOutbound = msgs.FirstOrDefault(m => m.Direction == MessageDirection.Outbound && m.SenderUserId != null);
            if (firstOutbound != null)
                firstResponseMinutes.Add((firstOutbound.CreatedAt - ticket.CreatedAt).TotalMinutes);

            for (var i = 0; i < msgs.Count - 1; i++)
            {
                if (msgs[i].Direction != MessageDirection.Inbound)
                    continue;

                var nextOutbound = msgs.Skip(i + 1)
                    .FirstOrDefault(m => m.Direction == MessageDirection.Outbound && m.SenderUserId != null);
                if (nextOutbound != null)
                    responseMinutes.Add((nextOutbound.CreatedAt - msgs[i].CreatedAt).TotalMinutes);
            }
        }

        return new ResponseTimesDto(
            firstResponseMinutes.Count > 0 ? Math.Round(firstResponseMinutes.Average(), 1) : 0,
            responseMinutes.Count > 0 ? Math.Round(responseMinutes.Average(), 1) : 0,
            resolutionMinutes.Count > 0 ? Math.Round(resolutionMinutes.Average(), 1) : 0,
            tickets.Count,
            query.Scope ?? "all");
    }

    public async Task<IReadOnlyList<TicketVolumeItemDto>> GetTicketVolumeAsync(AnalyticsQuery query, string groupBy, int? userId)
    {
        var ticketsQuery = ApplyAnalyticsQuery(db.Tickets.AsNoTracking(), query, userId);
        var tickets = await ticketsQuery
            .Select(t => new { t.CreatedAt, t.Status, t.UpdatedAt })
            .ToListAsync();

        if (tickets.Count == 0)
            return [];

        var from = (query.From ?? tickets.Min(t => t.CreatedAt));
        var to = (query.To ?? DateTime.UtcNow);

        if (groupBy == "hour")
        {
            var receivedByHour = tickets
                .GroupBy(t => new DateTime(t.CreatedAt.Year, t.CreatedAt.Month, t.CreatedAt.Day, t.CreatedAt.Hour, 0, 0, DateTimeKind.Utc))
                .ToDictionary(g => g.Key, g => g.Count());

            var resolvedByHour = tickets
                .Where(t => t.Status == TicketStatus.Resolved || t.Status == TicketStatus.Closed)
                .GroupBy(t => new DateTime(t.UpdatedAt.Year, t.UpdatedAt.Month, t.UpdatedAt.Day, t.UpdatedAt.Hour, 0, 0, DateTimeKind.Utc))
                .ToDictionary(g => g.Key, g => g.Count());

            var result = new List<TicketVolumeItemDto>();
            var cursor = new DateTime(from.Year, from.Month, from.Day, from.Hour, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(to.Year, to.Month, to.Day, to.Hour, 0, 0, DateTimeKind.Utc);
            while (cursor <= end)
            {
                receivedByHour.TryGetValue(cursor, out var received);
                resolvedByHour.TryGetValue(cursor, out var resolved);
                result.Add(new TicketVolumeItemDto(cursor.ToString("yyyy-MM-dd HH:00"), received, resolved));
                cursor = cursor.AddHours(1);
            }
            return result;
        }
        else
        {
            var receivedByDay = tickets
                .GroupBy(t => t.CreatedAt.Date)
                .ToDictionary(g => g.Key, g => g.Count());

            var resolvedByDay = tickets
                .Where(t => t.Status == TicketStatus.Resolved || t.Status == TicketStatus.Closed)
                .GroupBy(t => t.UpdatedAt.Date)
                .ToDictionary(g => g.Key, g => g.Count());

            var result = new List<TicketVolumeItemDto>();
            var cursor = from.Date;
            var end = to.Date;
            while (cursor <= end)
            {
                receivedByDay.TryGetValue(cursor, out var received);
                resolvedByDay.TryGetValue(cursor, out var resolved);
                result.Add(new TicketVolumeItemDto(cursor.ToString("yyyy-MM-dd"), received, resolved));
                cursor = cursor.AddDays(1);
            }
            return result;
        }
    }

    public async Task<SlaComplianceDto> GetSlaComplianceScopedAsync(AnalyticsQuery query, int? userId)
    {
        var ticketsQuery = ApplyAnalyticsQuery(db.Tickets.AsNoTracking(), query, userId)
            .Where(t => t.SlaDueAt != null);

        var total = await ticketsQuery.CountAsync();
        var breached = await ticketsQuery.CountAsync(t => t.SlaBreach);
        var compliant = total - breached;
        var percentage = total == 0 ? 0 : Math.Round(compliant / (double)total * 100, 1);

        return new SlaComplianceDto(total, compliant, breached, percentage);
    }

    public async Task<SlaComplianceDto> GetSlaBreakdownAsync(AnalyticsQuery query, int? userId)
        => await GetSlaComplianceScopedAsync(query, userId);

    public async Task<IReadOnlyList<RecentTicketItemDto>> GetRecentTicketsAsync(AnalyticsQuery query, int limit)
    {
        var q = ApplyAnalyticsQuery(db.Tickets.AsNoTracking(), query, null);
        return await q
            .OrderByDescending(t => t.CreatedAt)
            .Take(limit)
            .Select(t => new RecentTicketItemDto(
                t.Id,
                t.Subject,
                t.Status.ToString(),
                t.Priority.ToString(),
                t.RequesterName,
                t.CreatedAt,
                t.AssignedTo != null ? t.AssignedTo.FullName : null))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<MyOpenTicketItemDto>> GetMyOpenTicketsAsync(int userId, int limit)
    {
        var openStatuses = new[] { TicketStatus.New, TicketStatus.Open, TicketStatus.Pending };
        return await db.Tickets.AsNoTracking()
            .Where(t => t.AssignedToId == userId && openStatuses.Contains(t.Status) && !t.IsMerged)
            .OrderBy(t => t.SlaDueAt.HasValue ? 0 : 1)
            .ThenBy(t => t.SlaDueAt)
            .ThenByDescending(t => t.CreatedAt)
            .Take(limit)
            .Select(t => new MyOpenTicketItemDto(
                t.Id,
                t.Subject,
                t.Status.ToString(),
                t.Priority.ToString(),
                t.SlaDueAt,
                t.SlaBreach))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<CategoryBreakdownItemDto>> GetCategoryBreakdownAsync(AnalyticsQuery query, int? userId, int limit)
    {
        var q = ApplyAnalyticsQuery(db.Tickets.AsNoTracking(), query, userId);

        var grouped = await q
            .GroupBy(t => t.CategoryId)
            .Select(g => new { CategoryId = g.Key, Count = g.Count() })
            .ToListAsync();

        var categories = await db.TicketCategories.AsNoTracking()
            .ToDictionaryAsync(c => c.Id, c => new { c.Name, c.DisplayOrder });

        return grouped
            .Select(g => new
            {
                CategoryName = g.CategoryId.HasValue && categories.TryGetValue(g.CategoryId.Value, out var cat)
                    ? cat.Name : "Nincs kategória",
                DisplayOrder = g.CategoryId.HasValue && categories.TryGetValue(g.CategoryId.Value, out var cat2)
                    ? cat2.DisplayOrder : 999,
                g.Count
            })
            .OrderBy(x => x.DisplayOrder)
            .Take(limit)
            .Select(x => new CategoryBreakdownItemDto(x.CategoryName, x.Count))
            .ToList();
    }

    public async Task<IReadOnlyList<AgentPerformanceItemDto>> GetAgentPerformanceAsync(AnalyticsQuery query)
    {
        var q = ApplyAnalyticsQuery(db.Tickets.AsNoTracking(), query, null)
            .Where(t => t.AssignedToId.HasValue);

        var tickets = await q
            .Select(t => new { t.Id, t.AssignedToId, t.CreatedAt, t.Status, t.UpdatedAt })
            .ToListAsync();

        if (tickets.Count == 0) return [];

        var agentIds = tickets.Select(t => t.AssignedToId!.Value).Distinct().ToList();
        var agents = await db.Users.AsNoTracking()
            .Where(u => agentIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName);

        var ticketIds = tickets.Select(t => t.Id).ToList();
        var messages = await db.TicketMessages.AsNoTracking()
            .Where(m => ticketIds.Contains(m.TicketId) && !m.IsInternalNote)
            .OrderBy(m => m.TicketId).ThenBy(m => m.CreatedAt)
            .Select(m => new { m.TicketId, m.Direction, m.SenderUserId, m.CreatedAt })
            .ToListAsync();

        var msgByTicket = messages.GroupBy(m => m.TicketId).ToDictionary(g => g.Key, g => g.ToList());

        var byAgent = tickets.GroupBy(t => t.AssignedToId!.Value);
        var result = new List<AgentPerformanceItemDto>();

        foreach (var group in byAgent)
        {
            var agentName = agents.TryGetValue(group.Key, out var name) ? name : $"Agent #{group.Key}";
            var resolved = group.Count(t => t.Status == TicketStatus.Resolved || t.Status == TicketStatus.Closed);
            var resolutionMins = group
                .Where(t => t.Status == TicketStatus.Resolved || t.Status == TicketStatus.Closed)
                .Select(t => (t.UpdatedAt - t.CreatedAt).TotalMinutes)
                .ToList();
            var responseMins = new List<double>();

            foreach (var ticket in group)
            {
                if (!msgByTicket.TryGetValue(ticket.Id, out var msgs)) continue;
                var firstOut = msgs.FirstOrDefault(m => m.Direction == MessageDirection.Outbound && m.SenderUserId != null);
                if (firstOut != null)
                    responseMins.Add((firstOut.CreatedAt - ticket.CreatedAt).TotalMinutes);
            }

            result.Add(new AgentPerformanceItemDto(
                agentName,
                resolved,
                resolutionMins.Count > 0 ? Math.Round(resolutionMins.Average(), 1) : 0,
                responseMins.Count > 0 ? Math.Round(responseMins.Average(), 1) : 0));
        }

        return result.OrderByDescending(a => a.Resolved).ToList();
    }

    public async Task<IReadOnlyList<CustomerActivityItemDto>> GetCustomerActivityAsync(AnalyticsQuery query, int limit)
    {
        var q = ApplyAnalyticsQuery(db.Tickets.AsNoTracking(), query, null)
            .Where(t => t.ContactId.HasValue);

        var grouped = await q
            .GroupBy(t => t.Contact!.CompanyId)
            .Select(g => new { CompanyId = g.Key, Count = g.Count() })
            .ToListAsync();

        var companyIds = grouped.Where(g => g.CompanyId.HasValue).Select(g => g.CompanyId!.Value).ToList();
        var companies = await db.Companies.AsNoTracking()
            .Where(c => companyIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => new { c.Name, c.Domain });

        return grouped
            .Where(g => g.CompanyId.HasValue)
            .Select(g =>
            {
                companies.TryGetValue(g.CompanyId!.Value, out var co);
                return new CustomerActivityItemDto(g.CompanyId, co?.Name ?? $"Cég #{g.CompanyId}", co?.Domain, g.Count);
            })
            .OrderByDescending(x => x.TicketCount)
            .Take(limit)
            .ToList();
    }

    private static IQueryable<Domain.Entities.Ticket> ApplyPeriod(IQueryable<Domain.Entities.Ticket> ticketsQuery, AnalyticsPeriodQuery query)
    {
        if (query.DateFrom.HasValue)
            ticketsQuery = ticketsQuery.Where(t => t.CreatedAt >= query.DateFrom.Value);

        if (query.DateTo.HasValue)
            ticketsQuery = ticketsQuery.Where(t => t.CreatedAt <= query.DateTo.Value);

        return ticketsQuery;
    }

    private static IQueryable<Domain.Entities.Ticket> ApplyAnalyticsQuery(IQueryable<Domain.Entities.Ticket> q, AnalyticsQuery query, int? userId)
    {
        q = q.Where(t => !t.IsMerged);

        if (query.From.HasValue)
            q = q.Where(t => t.CreatedAt >= query.From.Value);
        if (query.To.HasValue)
            q = q.Where(t => t.CreatedAt <= query.To.Value);
        if (userId.HasValue)
            q = q.Where(t => t.AssignedToId == userId.Value);

        return q;
    }
}
