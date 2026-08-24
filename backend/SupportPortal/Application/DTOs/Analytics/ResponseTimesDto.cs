namespace SupportPortal.Application.DTOs.Analytics;

public record ResponseTimesDto(
    double AvgFirstResponseMinutes,
    double AvgResponseMinutes,
    double AvgResolutionMinutes,
    int TotalTickets,
    string Scope);
