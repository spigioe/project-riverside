using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SupportPortal.Application.DTOs;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;

namespace SupportPortal.Infrastructure.Services;

/// <summary>
/// IEmailService megvalósítás, amely futásidőben választ implementációt a beállított provider alapján.
/// Minden híváskor beolvassa a MailSettings-t a DB-ből (IntegrationSettings "Email" rekord), ha van;
/// egyébként az appsettings értékeit használja. Ez lehetővé teszi, hogy az email provider az API-n
/// keresztül, újraindítás nélkül megváltoztatható legyen.
/// </summary>
public class EmailServiceRouter(
    AppDbContext db,
    IOptions<MailSettings> defaultOptions,
    IEncryptionService encryptionService,
    HttpClient mailpitHttpClient,
    IHttpClientFactory httpClientFactory,
    ILogger<EmailServiceRouter> logger,
    ILogger<ImapEmailService> imapLogger) : IEmailService
{
    internal const string IntegrationType = "Email";

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public async Task<string> SendAsync(string to, string subject, string body, string? inReplyTo, string? references, string? cc = null, string? bcc = null)
    {
        var svc = await ResolveAsync();
        return await svc.SendAsync(to, subject, body, inReplyTo, references, cc, bcc);
    }

    public async Task<List<InboundEmail>> FetchNewAsync()
    {
        var svc = await ResolveAsync();
        return await svc.FetchNewAsync();
    }

    internal async Task<MailSettings> LoadSettingsAsync()
    {
        var stored = await db.IntegrationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.IntegrationType == IntegrationType);

        if (stored is null)
            return defaultOptions.Value;

        try
        {
            var decoded = JsonSerializer.Deserialize<MailSettings>(
                encryptionService.Decrypt(stored.Config), JsonOpts)!;
            return decoded;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Nem sikerült dekódolni az email beállításokat — az alapértelmezett konfiguráció kerül használatra.");
            return defaultOptions.Value;
        }
    }

    private async Task<IEmailService> ResolveAsync()
    {
        var settings = await LoadSettingsAsync();

        if (settings.Provider.Equals("imap", StringComparison.OrdinalIgnoreCase) ||
            settings.Provider.Equals("gmail", StringComparison.OrdinalIgnoreCase))
        {
            return new ImapEmailService(settings, imapLogger, httpClientFactory);
        }

        return new MailpitEmailService(mailpitHttpClient, settings, logger, httpClientFactory);
    }
}
