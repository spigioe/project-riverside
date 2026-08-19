using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Notifications;

public record NotificationPreferenceDto(NotificationTrigger TriggerType, bool IsEnabled);

public record UpdateNotificationPreferencesRequest(IReadOnlyList<NotificationPreferenceDto> Preferences);
