using System.Security.Claims;
using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SupportPortal.Application.DTOs;
using SupportPortal.Application.DTOs.Settings;
using SupportPortal.Domain.Entities;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Infrastructure.Services;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize(Roles = "MasterAdmin,Admin")]
[Route("api/portal/settings")]
public class SettingsController(
    IOptions<MailSettings> mailOptions,
    AppDbContext db,
    IEncryptionService encryptionService,
    ILogger<SettingsController> logger) : ControllerBase
{
    [HttpGet("email")]
    [ProducesResponseType(typeof(EmailSettingsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetEmailSettings()
    {
        var stored = await db.IntegrationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.IntegrationType == EmailServiceRouter.IntegrationType);

        MailSettings settings;
        bool hasStored = stored is not null;

        if (stored is not null)
        {
            try
            {
                settings = JsonSerializer.Deserialize<MailSettings>(
                    encryptionService.Decrypt(stored.Config),
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
            }
            catch
            {
                settings = mailOptions.Value;
                hasStored = false;
            }
        }
        else
        {
            settings = mailOptions.Value;
        }

        return Ok(new EmailSettingsDto(
            Provider: settings.Provider,
            SmtpHost: settings.SmtpHost,
            SmtpPort: settings.SmtpPort,
            ApiBaseUrl: settings.ApiBaseUrl,
            ImapHost: settings.ImapHost,
            ImapPort: settings.ImapPort,
            UseSsl: settings.UseSsl,
            Username: settings.Username,
            PasswordMasked: string.IsNullOrEmpty(settings.Password) ? "" : "••••••••",
            PollIntervalSeconds: settings.PollIntervalSeconds,
            FromAddress: settings.FromAddress,
            HasStoredConfig: hasStored
        ));
    }

    [HttpPut("email")]
    [ProducesResponseType(typeof(EmailSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateEmailSettings([FromBody] UpdateEmailSettingsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Provider))
            return BadRequest(new { title = "A provider mező kötelező." });

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Ha az új jelszó üres, megtartjuk a tárolt jelszót.
        string resolvedPassword = request.Password;
        if (string.IsNullOrEmpty(resolvedPassword))
        {
            var existing = await db.IntegrationSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.IntegrationType == EmailServiceRouter.IntegrationType);

            if (existing is not null)
            {
                try
                {
                    var prev = JsonSerializer.Deserialize<MailSettings>(
                        encryptionService.Decrypt(existing.Config),
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    resolvedPassword = prev?.Password ?? string.Empty;
                }
                catch { /* ha nem sikerül dekódolni, üres marad */ }
            }
        }

        var newSettings = new MailSettings
        {
            Provider = request.Provider,
            SmtpHost = request.SmtpHost,
            SmtpPort = request.SmtpPort,
            ApiBaseUrl = request.ApiBaseUrl ?? mailOptions.Value.ApiBaseUrl,
            ImapHost = request.ImapHost,
            ImapPort = request.ImapPort,
            UseSsl = request.UseSsl,
            Username = request.Username,
            Password = resolvedPassword,
            PollIntervalSeconds = request.PollIntervalSeconds,
            FromAddress = request.FromAddress,
        };

        var encrypted = encryptionService.Encrypt(JsonSerializer.Serialize(newSettings));

        var record = await db.IntegrationSettings
            .FirstOrDefaultAsync(s => s.IntegrationType == EmailServiceRouter.IntegrationType);

        if (record is null)
        {
            record = new IntegrationSetting
            {
                IntegrationType = EmailServiceRouter.IntegrationType,
                Config = encrypted,
                UpdatedById = userId,
            };
            db.IntegrationSettings.Add(record);
        }
        else
        {
            record.Config = encrypted;
            record.UpdatedById = userId;
            record.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();

        return Ok(new EmailSettingsDto(
            Provider: newSettings.Provider,
            SmtpHost: newSettings.SmtpHost,
            SmtpPort: newSettings.SmtpPort,
            ApiBaseUrl: newSettings.ApiBaseUrl,
            ImapHost: newSettings.ImapHost,
            ImapPort: newSettings.ImapPort,
            UseSsl: newSettings.UseSsl,
            Username: newSettings.Username,
            PasswordMasked: string.IsNullOrEmpty(newSettings.Password) ? "" : "••••••••",
            PollIntervalSeconds: newSettings.PollIntervalSeconds,
            FromAddress: newSettings.FromAddress,
            HasStoredConfig: true
        ));
    }

    [HttpPost("email/test")]
    [ProducesResponseType(typeof(TestEmailConnectionResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> TestEmailConnection([FromBody] TestEmailConnectionRequest request)
    {
        if (request.Provider.Equals("mailpit", StringComparison.OrdinalIgnoreCase))
        {
            // Mailpit esetén csak egy HTTP ping a /api/v1/info endpointra
            try
            {
                using var http = new HttpClient();
                http.BaseAddress = new Uri(request.ApiBaseUrl ?? "http://localhost:8025");
                http.Timeout = TimeSpan.FromSeconds(5);
                var resp = await http.GetAsync("/api/v1/info");
                return Ok(new TestEmailConnectionResponse(resp.IsSuccessStatusCode, resp.IsSuccessStatusCode ? "Mailpit elérhetőség OK." : $"HTTP {(int)resp.StatusCode}"));
            }
            catch (Exception ex)
            {
                return Ok(new TestEmailConnectionResponse(false, $"Nem sikerült elérni a Mailpit API-t: {ex.Message}"));
            }
        }

        // IMAP kapcsolat teszt
        try
        {
            var testSettings = new MailSettings
            {
                Provider = request.Provider,
                ImapHost = request.ImapHost,
                ImapPort = request.ImapPort,
                UseSsl = request.UseSsl,
                Username = request.Username,
                Password = request.Password,
                SmtpHost = request.SmtpHost,
                SmtpPort = request.SmtpPort,
                FromAddress = request.FromAddress,
            };

            using var imap = new MailKit.Net.Imap.ImapClient();
            var sslOpt = testSettings.UseSsl
                ? MailKit.Security.SecureSocketOptions.SslOnConnect
                : MailKit.Security.SecureSocketOptions.StartTlsWhenAvailable;

            await imap.ConnectAsync(testSettings.ImapHost, testSettings.ImapPort, sslOpt);
            await imap.AuthenticateAsync(testSettings.Username, testSettings.Password);
            await imap.DisconnectAsync(true);

            return Ok(new TestEmailConnectionResponse(true, $"IMAP kapcsolat sikeres ({testSettings.ImapHost}:{testSettings.ImapPort})."));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Email kapcsolat teszt meghiúsult.");
            return Ok(new TestEmailConnectionResponse(false, $"Kapcsolódási hiba: {ex.Message}"));
        }
    }

    [HttpGet("auto-responder")]
    [ProducesResponseType(typeof(AutoResponderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAutoResponder()
    {
        var template = await db.AutoResponderTemplates
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Trigger == "new_ticket");

        if (template is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Nincs auto-responder sablon.");

        return Ok(new AutoResponderDto(
            template.Id,
            template.Trigger,
            template.SubjectTemplate,
            template.BodyTemplate,
            template.IsEnabled));
    }

    [HttpPut("auto-responder")]
    [ProducesResponseType(typeof(AutoResponderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateAutoResponder([FromBody] UpdateAutoResponderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SubjectTemplate))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "A tárgy sablon nem lehet üres.");

        if (string.IsNullOrWhiteSpace(request.BodyTemplate))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Az üzenet sablon nem lehet üres.");

        var template = await db.AutoResponderTemplates.FirstOrDefaultAsync(t => t.Trigger == "new_ticket");
        if (template is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Nincs auto-responder sablon.");

        template.SubjectTemplate = request.SubjectTemplate;
        template.BodyTemplate = request.BodyTemplate;
        template.IsEnabled = request.IsEnabled;

        await db.SaveChangesAsync();

        return Ok(new AutoResponderDto(
            template.Id,
            template.Trigger,
            template.SubjectTemplate,
            template.BodyTemplate,
            template.IsEnabled));
    }
}
