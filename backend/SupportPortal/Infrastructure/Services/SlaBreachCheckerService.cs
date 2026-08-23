using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public class SlaBreachCheckerService(
    IServiceScopeFactory scopeFactory,
    ILogger<SlaBreachCheckerService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    await CheckBreachesAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Hiba történt az SLA breach ellenőrzés során.");
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Normál leállás — nem hiba.
        }
    }

    private async Task CheckBreachesAsync(CancellationToken stoppingToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var now = DateTime.UtcNow;

        var breachedTickets = await db.Tickets
            .Where(t =>
                !t.IsDeleted &&
                t.Status != TicketStatus.Resolved &&
                t.Status != TicketStatus.Closed &&
                t.SlaDueAt.HasValue &&
                t.SlaDueAt.Value < now &&
                !t.SlaBreach)
            .Select(t => new { t.Id, t.Subject, t.AssignedToId })
            .ToListAsync(stoppingToken);

        if (breachedTickets.Count == 0) return;

        var ids = breachedTickets.Select(t => t.Id).ToList();
        await db.Tickets
            .Where(t => ids.Contains(t.Id))
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.SlaBreach, true), stoppingToken);

        logger.LogInformation("SLA breach: {Count} ticket(ek) megjelölve.", breachedTickets.Count);

        foreach (var ticket in breachedTickets)
        {
            if (!ticket.AssignedToId.HasValue) continue;

            await notificationService.SendAsync(
                ticket.AssignedToId.Value,
                NotificationTrigger.SlaBreached,
                ticket.Id,
                $"SLA megsértve: #{ticket.Id} {ticket.Subject}");
        }
    }
}
