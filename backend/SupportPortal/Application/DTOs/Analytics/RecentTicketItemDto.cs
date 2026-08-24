namespace SupportPortal.Application.DTOs.Analytics;

public record RecentTicketItemDto(
    int Id,
    string Subject,
    string Status,
    string Priority,
    string RequesterName,
    DateTime CreatedAt,
    string? AssignedToName);
