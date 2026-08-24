using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.DTOs.Contacts;

public record ContactDto(
    int Id,
    string Email,
    string Name,
    int? CompanyId,
    string? CompanyName,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record ContactDetailDto(
    int Id,
    string Email,
    string Name,
    int? CompanyId,
    string? CompanyName,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<TicketSummaryDto> RecentTickets
);

public record TicketSummaryDto(
    int Id,
    string Subject,
    string Status,
    DateTime CreatedAt
);

public record ContactListQuery(
    string? Search = null,
    int? CompanyId = null,
    int Page = 1,
    int PageSize = 25
);

public record CreateContactRequest(
    string Email,
    string Name,
    int? CompanyId
);

public record UpdateContactRequest(
    string Email,
    string Name,
    int? CompanyId
);

public record AssignTicketContactRequest(int? ContactId);

public record BuildFromTicketsResult(int ContactsCreated, int ContactsLinked, int TicketsUpdated, int CompaniesCreated);
