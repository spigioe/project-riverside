using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Tickets;

public record TicketListQuery(
    TicketStatus? Status = null,
    TicketPriority? Priority = null,
    int? CategoryId = null,
    string? Search = null,
    DateTime? DateFrom = null,
    DateTime? DateTo = null,
    int Page = 1,
    int PageSize = 20,
    int? AssignedToId = null,
    TicketSource? Source = null,
    int? CompanyId = null,
    int? ContactId = null
);
