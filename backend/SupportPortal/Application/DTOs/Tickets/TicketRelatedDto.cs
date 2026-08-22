using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Tickets;

public record TicketRelatedDto(
    int Id,
    string Subject,
    TicketStatus Status,
    TicketPriority Priority,
    DateTime CreatedAt
);
