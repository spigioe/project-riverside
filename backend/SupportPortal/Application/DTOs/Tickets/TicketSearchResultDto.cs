using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Tickets;

public record TicketSearchResultDto(
    int Id,
    string Subject,
    TicketStatus Status,
    string RequesterEmail
);
