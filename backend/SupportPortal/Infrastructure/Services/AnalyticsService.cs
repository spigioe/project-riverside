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

        // Allekérdezés (IN (SELECT ...)) a memóriában összegyűjtött, akár több ezer elemű ID-lista helyett.
        var ticketIds = ticketsQuery.Select(t => t.Id);

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

        var ticketIds = q.Select(t => t.Id);
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

    private static readonly TicketStatus[] OpenStatuses = [TicketStatus.New, TicketStatus.Open, TicketStatus.Pending];
    private static readonly string[] ResolvedStatusNames = [nameof(TicketStatus.Resolved), nameof(TicketStatus.Closed)];
    private static readonly string[] OpenStatusNames = [nameof(TicketStatus.New), nameof(TicketStatus.Open), nameof(TicketStatus.Pending)];

    // Backlog kor-kategóriák: (kulcs, címke, felső határ órában — az utolsó nyitott végű)
    private static readonly (string Key, string Label, double MaxHours)[] BacklogBuckets =
    [
        ("lt1d", "< 1 nap", 24),
        ("1to3d", "1–3 nap", 72),
        ("3to7d", "3–7 nap", 168),
        ("7to30d", "7–30 nap", 720),
        ("gt30d", "> 30 nap", double.MaxValue),
    ];

    public async Task<BacklogAgeDto> GetBacklogAgeAsync(int? userId)
    {
        var q = db.Tickets.AsNoTracking().Where(t => !t.IsMerged && OpenStatuses.Contains(t.Status));
        if (userId.HasValue)
            q = q.Where(t => t.AssignedToId == userId.Value);

        var tickets = await q.Select(t => new { t.Id, t.CreatedAt, t.Priority }).ToListAsync();
        var now = DateTime.UtcNow;
        var aged = tickets.Select(t => new { t.Id, t.Priority, AgeHours = Math.Max(0, (now - t.CreatedAt).TotalHours) }).ToList();

        var buckets = new List<BacklogAgeBucketDto>();
        var lower = 0d;
        foreach (var (key, label, maxHours) in BacklogBuckets)
        {
            var inBucket = aged.Where(t => t.AgeHours >= lower && t.AgeHours < maxHours).ToList();
            buckets.Add(new BacklogAgeBucketDto(
                key, label,
                inBucket.Count(t => t.Priority == TicketPriority.Low),
                inBucket.Count(t => t.Priority == TicketPriority.Medium),
                inBucket.Count(t => t.Priority == TicketPriority.High),
                inBucket.Count(t => t.Priority == TicketPriority.Urgent),
                inBucket.Count));
            lower = maxHours;
        }

        var oldest = aged.OrderByDescending(t => t.AgeHours).FirstOrDefault();
        return new BacklogAgeDto(
            buckets,
            aged.Count,
            aged.Count > 0 ? Math.Round(aged.Average(t => t.AgeHours), 1) : 0,
            oldest?.Id,
            oldest != null ? Math.Round(oldest.AgeHours, 1) : 0);
    }

    public async Task<IReadOnlyList<VolumeHeatmapCellDto>> GetVolumeHeatmapAsync(AnalyticsQuery query, int? userId, int tzOffsetMinutes)
    {
        var createdAts = await ApplyAnalyticsQuery(db.Tickets.AsNoTracking(), query, userId)
            .Select(t => t.CreatedAt)
            .ToListAsync();

        var counts = new int[7, 24];
        foreach (var createdAt in createdAts)
        {
            var local = createdAt.AddMinutes(tzOffsetMinutes);
            var day = ((int)local.DayOfWeek + 6) % 7; // hétfő = 0
            counts[day, local.Hour]++;
        }

        var result = new List<VolumeHeatmapCellDto>(7 * 24);
        for (var d = 0; d < 7; d++)
            for (var h = 0; h < 24; h++)
                result.Add(new VolumeHeatmapCellDto(d, h, counts[d, h]));
        return result;
    }

    public async Task<IReadOnlyList<SlaAtRiskItemDto>> GetSlaAtRiskAsync(int? userId, int hours, int limit)
    {
        var now = DateTime.UtcNow;
        var threshold = now.AddHours(hours);

        // A lejárt, de a SlaBreachChecker által még meg nem jelölt jegyek is ide kerülnek (negatív hátralévő idővel).
        var q = db.Tickets.AsNoTracking()
            .Where(t => !t.IsMerged
                && OpenStatuses.Contains(t.Status)
                && !t.SlaBreach
                && t.SlaPausedAt == null
                && t.SlaDueAt != null
                && t.SlaDueAt <= threshold);
        if (userId.HasValue)
            q = q.Where(t => t.AssignedToId == userId.Value);

        var items = await q
            .OrderBy(t => t.SlaDueAt)
            .Take(limit)
            .Select(t => new
            {
                t.Id, t.Subject, t.Status, t.Priority,
                AssignedToName = t.AssignedTo != null ? t.AssignedTo.FullName : null,
                SlaDueAt = t.SlaDueAt!.Value,
            })
            .ToListAsync();

        return items
            .Select(t => new SlaAtRiskItemDto(
                t.Id, t.Subject, t.Status.ToString(), t.Priority.ToString(), t.AssignedToName,
                t.SlaDueAt, Math.Round((t.SlaDueAt - now).TotalMinutes, 0)))
            .ToList();
    }

    public async Task<ServiceQualityDto> GetServiceQualityAsync(AnalyticsQuery query, int? userId)
    {
        var ticketsQuery = ApplyAnalyticsQuery(db.Tickets.AsNoTracking(), query, userId);
        var tickets = await ticketsQuery
            .Select(t => new { t.Id, t.Status })
            .ToListAsync();

        if (tickets.Count == 0)
            return new ServiceQualityDto(0, 0, 0, 0, 0, 0, 0);

        var ticketIds = ticketsQuery.Select(t => t.Id);

        var agentReplies = await db.TicketMessages.AsNoTracking()
            .Where(m => ticketIds.Contains(m.TicketId)
                && !m.IsInternalNote
                && m.Direction == MessageDirection.Outbound
                && m.SenderUserId != null)
            .Select(m => m.TicketId)
            .ToListAsync();
        var repliesByTicket = agentReplies.GroupBy(id => id).ToDictionary(g => g.Key, g => g.Count());

        var statusChanges = await db.AuditLogs.AsNoTracking()
            .Where(l => l.EntityType == "ticket" && l.Action == "status_changed" && ticketIds.Contains(l.EntityId))
            .Select(l => new { l.EntityId, l.OldValue, l.NewValue })
            .ToListAsync();

        var reopenedIds = statusChanges
            .Where(l => ResolvedStatusNames.Contains(l.OldValue) && OpenStatusNames.Contains(l.NewValue))
            .Select(l => l.EntityId)
            .ToHashSet();
        var everResolvedIds = statusChanges
            .Where(l => ResolvedStatusNames.Contains(l.NewValue))
            .Select(l => l.EntityId)
            .ToHashSet();

        var resolved = tickets.Where(t => t.Status == TicketStatus.Resolved || t.Status == TicketStatus.Closed).ToList();
        everResolvedIds.UnionWith(resolved.Select(t => t.Id));

        // FCR: a megoldott (és nem újranyitott) jegyek közül azok, ahol pontosan egy ügyintézői válasz ment ki.
        var fcrEligible = resolved.Where(t => repliesByTicket.ContainsKey(t.Id)).ToList();
        var fcrCount = fcrEligible.Count(t => repliesByTicket[t.Id] == 1 && !reopenedIds.Contains(t.Id));
        var totalReplies = resolved.Sum(t => repliesByTicket.GetValueOrDefault(t.Id));

        return new ServiceQualityDto(
            tickets.Count,
            resolved.Count,
            fcrEligible.Count > 0 ? Math.Round(fcrCount / (double)fcrEligible.Count * 100, 1) : 0,
            fcrEligible.Count,
            everResolvedIds.Count > 0 ? Math.Round(reopenedIds.Count / (double)everResolvedIds.Count * 100, 1) : 0,
            reopenedIds.Count,
            resolved.Count > 0 ? Math.Round(totalReplies / (double)resolved.Count, 1) : 0);
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
