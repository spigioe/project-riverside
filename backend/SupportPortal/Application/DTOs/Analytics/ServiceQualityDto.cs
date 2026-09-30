namespace SupportPortal.Application.DTOs.Analytics;

public record ServiceQualityDto(
    int TicketsCreated,
    int TicketsResolved,
    double FirstContactResolutionRate,
    int FcrEligible,
    double ReopenRate,
    int ReopenedCount,
    double AvgRepliesPerResolved);
