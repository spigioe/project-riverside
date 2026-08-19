namespace SupportPortal.Application.DTOs.Analytics;

public record RecentActivityItemDto(
    string EventType,
    int TicketId,
    string TicketSubject,
    string? ActorName,
    string Description,
    DateTime OccurredAt
);
