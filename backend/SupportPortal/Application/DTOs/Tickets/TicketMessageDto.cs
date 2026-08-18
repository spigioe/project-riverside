using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Tickets;

public record TicketMessageDto(
    int Id,
    int TicketId,
    int? SenderUserId,
    string? SenderUserName,
    string? SenderEmail,
    string Body,
    bool IsInternalNote,
    MessageDirection Direction,
    DateTime CreatedAt
);
