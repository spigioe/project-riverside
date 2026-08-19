using SupportPortal.Application.DTOs.Dashboard;

namespace SupportPortal.Application.Interfaces;

public interface IDashboardService
{
    Task<IReadOnlyList<DashboardWidgetDto>> GetWidgetsAsync(int userId);
    Task<IReadOnlyList<DashboardWidgetDto>> SaveWidgetsAsync(int userId, IReadOnlyList<UpdateDashboardWidgetItem> widgets);
    Task<DashboardStatsDto> GetStatsAsync();
}
