namespace SupportPortal.Application.DTOs.Tickets;

public record ClickUpLinkDto(
    int Id,
    int TicketId,
    string ClickUpTaskId,
    string ClickUpTaskUrl,
    string? ClickUpTaskTitle,
    string? ClickUpStatus,
    DateTime? StatusSyncedAt,
    string? Notes,
    int CreatedById,
    string? CreatedByName,
    DateTime CreatedAt
);

public record CreateClickUpLinkRequest(
    string ClickUpTaskId,
    string ClickUpTaskUrl,
    string? ClickUpTaskTitle,
    string? Notes
);
