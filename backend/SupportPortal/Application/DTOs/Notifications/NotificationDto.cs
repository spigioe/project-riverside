using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Notifications;

public record NotificationDto(
    int Id,
    int? TicketId,
    NotificationTrigger TriggerType,
    string Message,
    bool IsRead,
    DateTime CreatedAt
);
