using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Tickets;

public record CreateTicketRequest(
    string Subject,
    string Body,
    TicketPriority Priority,
    int? CategoryId,
    string RequesterEmail,
    string RequesterName,
    int? AssignedToId
);
