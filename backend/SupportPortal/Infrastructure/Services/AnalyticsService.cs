using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Analytics;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Enums;

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

    private static IQueryable<Domain.Entities.Ticket> ApplyPeriod(IQueryable<Domain.Entities.Ticket> ticketsQuery, AnalyticsPeriodQuery query)
    {
        if (query.DateFrom.HasValue)
            ticketsQuery = ticketsQuery.Where(t => t.CreatedAt >= query.DateFrom.Value);

        if (query.DateTo.HasValue)
            ticketsQuery = ticketsQuery.Where(t => t.CreatedAt <= query.DateTo.Value);

        return ticketsQuery;
    }
}
