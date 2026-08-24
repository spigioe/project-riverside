using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Analytics;
using SupportPortal.Application.DTOs.Dashboard;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public class DashboardService(AppDbContext db, IAnalyticsService analyticsService) : IDashboardService
{
    private static readonly DashboardWidgetType[] DefaultWidgetTypes =
        [DashboardWidgetType.Unresolved, DashboardWidgetType.Overdue, DashboardWidgetType.Open, DashboardWidgetType.Unassigned];

    public async Task<IReadOnlyList<DashboardWidgetDto>> GetWidgetsAsync(int userId)
    {
        var widgets = await db.DashboardWidgets
            .AsNoTracking()
            .Where(w => w.UserId == userId)
            .OrderBy(w => w.PositionY).ThenBy(w => w.PositionX)
            .ToListAsync();

        if (widgets.Count > 0)
            return widgets.Select(MapToDto).ToList();

        // Nincs még mentett konfig ehhez a userhez — default lista létrehozása és mentése,
        // hogy a következő GET már a mentett (esetlegesen a user által átrendezett) állapotot adja vissza.
        var defaults = DefaultWidgetTypes
            .Select((type, index) => new DashboardWidget
            {
                UserId = userId,
                WidgetType = type,
                PositionX = index,
                PositionY = 0,
                Width = 1,
                Height = 1,
            })
            .ToList();

        db.DashboardWidgets.AddRange(defaults);
        await db.SaveChangesAsync();

        return defaults.Select(MapToDto).ToList();
    }

    public async Task<IReadOnlyList<DashboardWidgetDto>> SaveWidgetsAsync(int userId, IReadOnlyList<UpdateDashboardWidgetItem> widgets)
    {
        var existing = await db.DashboardWidgets.Where(w => w.UserId == userId).ToListAsync();
        db.DashboardWidgets.RemoveRange(existing);

        var toInsert = widgets
            .Select(w => new DashboardWidget
            {
                UserId = userId,
                WidgetType = w.WidgetType,
                PositionX = w.PositionX,
                PositionY = w.PositionY,
                Width = w.Width,
                Height = w.Height,
                Config = w.Config,
            })
            .ToList();

        db.DashboardWidgets.AddRange(toInsert);
        await db.SaveChangesAsync();

        return toInsert.Select(MapToDto).ToList();
    }

    public async Task<DashboardStatsDto> GetStatsAsync()
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        var unresolved = await db.Tickets.CountAsync(t =>
            !t.IsMerged &&
            (t.Status == TicketStatus.New || t.Status == TicketStatus.Open || t.Status == TicketStatus.Pending));

        var overdue = await db.Tickets.CountAsync(t => t.SlaBreach && !t.IsMerged);

        var dueToday = await db.Tickets.CountAsync(t =>
            !t.IsMerged && !t.SlaBreach && t.SlaDueAt != null && t.SlaDueAt >= today && t.SlaDueAt < tomorrow &&
            t.Status != TicketStatus.Closed && t.Status != TicketStatus.Resolved);

        var open = await db.Tickets.CountAsync(t => t.Status == TicketStatus.Open && !t.IsMerged);

        var unassigned = await db.Tickets.CountAsync(t => t.AssignedToId == null && !t.IsMerged);

        var slaCompliance = await analyticsService.GetSlaComplianceAsync(new AnalyticsPeriodQuery());

        return new DashboardStatsDto(unresolved, overdue, dueToday, open, unassigned, slaCompliance.CompliancePercentage);
    }

    private static DashboardWidgetDto MapToDto(DashboardWidget w) =>
        new(w.Id, w.WidgetType, w.PositionX, w.PositionY, w.Width, w.Height, w.Config);
}
