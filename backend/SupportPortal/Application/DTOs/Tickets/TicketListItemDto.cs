using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Tickets;

public record TicketListItemDto(
    int Id,
    string Subject,
    TicketStatus Status,
    TicketPriority Priority,
    int? CategoryId,
    string? CategoryName,
    int? AssignedToId,
    string? AssignedToName,
    string RequesterEmail,
    string RequesterName,
    string RequesterCompany,
    bool IsCsmFlagged,
    bool IsMerged,
    DateTime? SlaDueAt,
    bool SlaBreach,
    string? LastMessageBody,
    DateTime? LastMessageAt,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    TicketSource Source
);
