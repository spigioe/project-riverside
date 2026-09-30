using SupportPortal.Application.DTOs.Analytics;

namespace SupportPortal.Application.Interfaces;

public interface IAnalyticsService
{
    Task<IReadOnlyList<TicketsByCategoryDto>> GetTicketsByCategoryAsync(AnalyticsPeriodQuery query);
    Task<IReadOnlyList<TicketsByStatusDto>> GetTicketsByStatusAsync(AnalyticsPeriodQuery query);
    Task<SlaComplianceDto> GetSlaComplianceAsync(AnalyticsPeriodQuery query);
    Task<IReadOnlyList<RecentActivityItemDto>> GetRecentActivityAsync(int limit);

    Task<ResponseTimesDto> GetResponseTimesAsync(AnalyticsQuery query, int? userId);
    Task<IReadOnlyList<TicketVolumeItemDto>> GetTicketVolumeAsync(AnalyticsQuery query, string groupBy, int? userId);
    Task<SlaComplianceDto> GetSlaComplianceScopedAsync(AnalyticsQuery query, int? userId);

    Task<SlaComplianceDto> GetSlaBreakdownAsync(AnalyticsQuery query, int? userId);
    Task<IReadOnlyList<RecentTicketItemDto>> GetRecentTicketsAsync(AnalyticsQuery query, int limit);
    Task<IReadOnlyList<MyOpenTicketItemDto>> GetMyOpenTicketsAsync(int userId, int limit);
    Task<IReadOnlyList<CategoryBreakdownItemDto>> GetCategoryBreakdownAsync(AnalyticsQuery query, int? userId, int limit);
    Task<IReadOnlyList<AgentPerformanceItemDto>> GetAgentPerformanceAsync(AnalyticsQuery query);
    Task<IReadOnlyList<CustomerActivityItemDto>> GetCustomerActivityAsync(AnalyticsQuery query, int limit);

    Task<BacklogAgeDto> GetBacklogAgeAsync(int? userId);
    Task<IReadOnlyList<VolumeHeatmapCellDto>> GetVolumeHeatmapAsync(AnalyticsQuery query, int? userId, int tzOffsetMinutes);
    Task<IReadOnlyList<SlaAtRiskItemDto>> GetSlaAtRiskAsync(int? userId, int hours, int limit);
    Task<ServiceQualityDto> GetServiceQualityAsync(AnalyticsQuery query, int? userId);
}
