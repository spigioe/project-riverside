using Microsoft.AspNetCore.Http;
using SupportPortal.Application.DTOs.Notifications;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.Interfaces;

public interface INotificationService
{
    /// <summary>
    /// Elmenti az értesítést, és — ha a user preferenciája engedi — kiküldi az összes nyitott
    /// SSE kapcsolatán keresztül is.
    /// </summary>
    Task SendAsync(int userId, NotificationTrigger trigger, int? ticketId, string message);

    /// <summary>
    /// Regisztrálja a választ mint nyitott SSE kapcsolatot a userhez, és blokkol, amíg a kliens
    /// le nem kapcsolódik (cancellationToken). Ezt hívja a stream controller action.
    /// </summary>
    Task StreamAsync(int userId, HttpResponse response, CancellationToken cancellationToken);

    Task<IReadOnlyList<NotificationDto>> GetUnreadAsync(int userId);
    Task<bool> MarkAsReadAsync(int notificationId, int userId);
    Task MarkAllAsReadAsync(int userId);
}
