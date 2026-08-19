using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Dashboard;

public record DashboardWidgetDto(int Id, DashboardWidgetType WidgetType, int PositionX, int PositionY, int Width, int Height, string? Config);

public record UpdateDashboardWidgetItem(DashboardWidgetType WidgetType, int PositionX, int PositionY, int Width, int Height, string? Config);

public record UpdateDashboardWidgetsRequest(IReadOnlyList<UpdateDashboardWidgetItem> Widgets);

public record DashboardStatsDto(int Unresolved, int Overdue, int DueToday, int Open, int Unassigned, double SlaCompliance);
