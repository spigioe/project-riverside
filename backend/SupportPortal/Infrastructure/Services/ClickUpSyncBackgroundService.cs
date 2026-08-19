using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SupportPortal.Application.Interfaces;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public class ClickUpSyncBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<ClickUpSyncBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var clickUpLinkService = scope.ServiceProvider.GetRequiredService<IClickUpLinkService>();
                    await clickUpLinkService.SyncAllActiveLinksAsync(ClickUpSyncTrigger.Scheduler);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Hiba történt az ütemezett ClickUp szinkron során.");
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Normál leállás (a host stoppingToken-je jelezte) — a PeriodicTimer ilyenkor
            // OperationCanceledException-t dob a WaitForNextTickAsync-ból, ez nem hiba.
        }
    }
}
