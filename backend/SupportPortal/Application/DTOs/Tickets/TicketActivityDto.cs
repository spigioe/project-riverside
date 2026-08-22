namespace SupportPortal.Application.DTOs.Tickets;

public record TicketActivityDto(
    int Id,
    int? UserId,
    string? UserName,
    string Action,
    string? OldValue,
    string? NewValue,
    DateTime CreatedAt
);
