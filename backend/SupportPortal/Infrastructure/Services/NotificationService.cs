using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SupportPortal.Application.DTOs.Notifications;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

// Singleton: a nyitott SSE kapcsolatok listáját (userId -> HttpResponse-ok) egyetlen, az egész
// alkalmazás életciklusán át megosztott példányban kell tartani. A DbContext-hez (Scoped) ezért
// IServiceScopeFactory-n keresztül fér hozzá, saját scope-ot nyitva minden DB-műveletnél.
public class NotificationService(IServiceScopeFactory scopeFactory, ILogger<NotificationService> logger) : INotificationService
{
    private readonly ConcurrentDictionary<int, List<HttpResponse>> _connections = new();

    public async Task StreamAsync(int userId, HttpResponse response, CancellationToken cancellationToken)
    {
        var connections = _connections.GetOrAdd(userId, _ => []);
        lock (connections) { connections.Add(response); }

        try
        {
            // Időszakos "ping" komment-sor: életben tartja a kapcsolatot a proxykon át, és
            // gyorsan felfedi, ha a kliens valójában már lekapcsolódott.
            while (!cancellationToken.IsCancellationRequested)
            {
                await Task.Delay(TimeSpan.FromSeconds(25), cancellationToken);
                await response.WriteAsync(": ping\n\n", cancellationToken);
                await response.Body.FlushAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException)
        {
            // Normál lekapcsolódás.
        }
        finally
        {
            lock (connections) { connections.Remove(response); }
        }
    }

    public async Task SendAsync(int userId, NotificationTrigger trigger, int? ticketId, string message)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var preference = await db.NotificationPreferences
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId && p.TriggerType == trigger);

        if (preference is not null && !preference.IsEnabled)
            return;

        db.Notifications.Add(new Notification
        {
            UserId = userId,
            TicketId = ticketId,
            TriggerType = trigger,
            Message = message,
        });
        await db.SaveChangesAsync();

        if (!_connections.TryGetValue(userId, out var connections))
            return;

        var payload = JsonSerializer.Serialize(new
        {
            type = ToEventType(trigger),
            ticketId,
            message,
        });
        var bytes = Encoding.UTF8.GetBytes($"data: {payload}\n\n");

        List<HttpResponse> snapshot;
        lock (connections) { snapshot = [.. connections]; }

        foreach (var response in snapshot)
        {
            try
            {
                await response.Body.WriteAsync(bytes);
                await response.Body.FlushAsync();
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "SSE kapcsolat írása sikertelen a(z) {UserId} userhez, eltávolítom.", userId);
                lock (connections) { connections.Remove(response); }
            }
        }
    }

    public async Task<IReadOnlyList<NotificationDto>> GetUnreadAsync(int userId)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        return await db.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId && !n.IsRead)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new NotificationDto(n.Id, n.TicketId, n.TriggerType, n.Message, n.IsRead, n.CreatedAt))
            .ToListAsync();
    }

    public async Task<bool> MarkAsReadAsync(int notificationId, int userId)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var notification = await db.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);
        if (notification is null) return false;

        notification.IsRead = true;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task MarkAllAsReadAsync(int userId)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(setters => setters.SetProperty(n => n.IsRead, true));
    }

    public async Task<IReadOnlyList<NotificationPreferenceDto>> GetPreferencesAsync(int userId)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var existing = await db.NotificationPreferences
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .ToDictionaryAsync(p => p.TriggerType);

        return Enum.GetValues<NotificationTrigger>()
            .Select(t => new NotificationPreferenceDto(t, !existing.TryGetValue(t, out var p) || p.IsEnabled))
            .ToList();
    }

    public async Task<IReadOnlyList<NotificationPreferenceDto>> UpdatePreferencesAsync(int userId, UpdateNotificationPreferencesRequest request)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var existing = await db.NotificationPreferences
            .Where(p => p.UserId == userId)
            .ToDictionaryAsync(p => p.TriggerType);

        foreach (var pref in request.Preferences)
        {
            if (existing.TryGetValue(pref.TriggerType, out var row))
                row.IsEnabled = pref.IsEnabled;
            else
                db.NotificationPreferences.Add(new NotificationPreference
                {
                    UserId = userId,
                    TriggerType = pref.TriggerType,
                    IsEnabled = pref.IsEnabled,
                });
        }

        await db.SaveChangesAsync();
        return await GetPreferencesAsync(userId);
    }

    private static string ToEventType(NotificationTrigger trigger) => trigger switch
    {
        NotificationTrigger.NewTicket => "new_ticket",
        NotificationTrigger.Assigned => "assigned",
        NotificationTrigger.CsmFlagged => "csm_flagged",
        NotificationTrigger.NewMessage => "new_message",
        NotificationTrigger.StatusChanged => "status_changed",
        NotificationTrigger.SlaWarning => "sla_warning",
        NotificationTrigger.SlaBreached => "sla_breached",
        _ => "unknown",
    };
}
