using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Tickets;

public record UpdateTicketRequest(
    string Subject,
    string Body,
    TicketPriority Priority,
    int? CategoryId,
    string RequesterEmail,
    string RequesterName
);
