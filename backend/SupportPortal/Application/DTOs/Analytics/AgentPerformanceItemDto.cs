namespace SupportPortal.Application.DTOs.Analytics;

public record AgentPerformanceItemDto(
    string AgentName,
    int Resolved,
    double AvgResolutionMinutes,
    double AvgResponseMinutes);
