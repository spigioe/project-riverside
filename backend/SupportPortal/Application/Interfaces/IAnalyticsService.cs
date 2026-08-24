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
}
