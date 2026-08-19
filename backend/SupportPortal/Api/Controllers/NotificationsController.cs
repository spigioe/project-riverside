using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Api.Extensions;
using SupportPortal.Application.DTOs.Notifications;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/notifications")]
public class NotificationsController(INotificationService notificationService) : ControllerBase
{
    // SSE stream — nem szokványos JSON végpont, ezért nincs [ProducesResponseType]: a válasz egy
    // folyamatosan nyitva tartott text/event-stream, amit a frontend natív EventSource-szal fogyaszt,
    // nem a generált NSwag kliensen keresztül.
    [HttpGet("stream")]
    public async Task Stream()
    {
        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        await notificationService.StreamAsync(User.GetUserId(), Response, HttpContext.RequestAborted);
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<NotificationDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUnread()
    {
        var notifications = await notificationService.GetUnreadAsync(User.GetUserId());
        return Ok(notifications);
    }

    [HttpPatch("{id:int}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkAsRead(int id)
    {
        var success = await notificationService.MarkAsReadAsync(id, User.GetUserId());
        if (!success)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Az értesítés nem található.");

        return NoContent();
    }

    [HttpPatch("read-all")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarkAllAsRead()
    {
        await notificationService.MarkAllAsReadAsync(User.GetUserId());
        return NoContent();
    }

    [HttpGet("~/api/portal/notification-preferences")]
    [ProducesResponseType(typeof(IReadOnlyList<NotificationPreferenceDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPreferences()
    {
        return Ok(await notificationService.GetPreferencesAsync(User.GetUserId()));
    }

    [HttpPut("~/api/portal/notification-preferences")]
    [ProducesResponseType(typeof(IReadOnlyList<NotificationPreferenceDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdatePreferences([FromBody] UpdateNotificationPreferencesRequest request)
    {
        return Ok(await notificationService.UpdatePreferencesAsync(User.GetUserId(), request));
    }
}
