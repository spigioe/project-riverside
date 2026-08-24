namespace SupportPortal.Application.DTOs.Analytics;

public record MyOpenTicketItemDto(
    int Id,
    string Subject,
    string Status,
    string Priority,
    DateTime? SlaDueAt,
    bool SlaBreach);
