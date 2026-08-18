using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SupportPortal.Application.DTOs;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Infrastructure.Services;

public class EmailPollingService(
    IServiceScopeFactory scopeFactory,
    IOptions<MailSettings> mailOptions,
    ILogger<EmailPollingService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromSeconds(mailOptions.Value.PollIntervalSeconds);
        using var timer = new PeriodicTimer(interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
                var processor = scope.ServiceProvider.GetRequiredService<ITicketEmailProcessor>();

                var emails = await emailService.FetchNewAsync();
                if (emails.Count > 0)
                {
                    await processor.ProcessAsync(emails);
                    logger.LogInformation("{Count} új email feldolgozva.", emails.Count);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Hiba történt az email lekérdezés (IMAP polling) során.");
            }
        }
    }
}
