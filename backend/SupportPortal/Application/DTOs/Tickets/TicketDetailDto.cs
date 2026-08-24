using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Tickets;

public record TicketDetailDto(
    int Id,
    string Subject,
    string Body,
    TicketStatus Status,
    TicketPriority Priority,
    string? Type,
    int? CategoryId,
    string? CategoryName,
    int? AssignedToId,
    string? AssignedToName,
    int? CreatedById,
    string? CreatedByName,
    string RequesterEmail,
    string RequesterName,
    TicketSource Source,
    bool IsCsmFlagged,
    int? CsmId,
    string? CsmName,
    bool IsMerged,
    int? MergedIntoTicketId,
    DateTime? SlaDueAt,
    bool SlaBreach,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int? ContactId,
    string? ContactName,
    int? CompanyId,
    string? CompanyName,
    string? CustomStatusKey
);
