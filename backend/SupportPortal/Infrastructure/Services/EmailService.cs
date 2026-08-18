using System.Net.Http.Json;
using System.Text.Json;
using MailKit.Net.Smtp;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using MimeKit.Utils;
using SupportPortal.Application.DTOs;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Infrastructure.Services;

// A Mailpit nem biztosít IMAP szervert (csak SMTP + POP3 + HTTP API-t — lásd `mailpit --help`),
// ezért a bejövő emailek lekérdezése a Mailpit HTTP API-ján keresztül történik, nem IMAP-on.
// A kimenő küldés (SendAsync) továbbra is valódi SMTP-vel megy MailKit-en keresztül.
public class EmailService(HttpClient httpClient, IOptions<MailSettings> mailOptions, ILogger<EmailService> logger) : IEmailService
{
    private readonly MailSettings _settings = mailOptions.Value;

    // A Mailpit API válaszaiban a boríték mezői kisbetűsek ("unread", "messages"), a message
    // objektumok mezői viszont PascalCase-ek ("ID", "Read", ...) — case-insensitive olvasással
    // mindkettő biztonságosan illeszkedik a lenti record property nevekre.
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<string> SendAsync(string to, string subject, string body, string? inReplyTo, string? references)
    {
        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(_settings.FromAddress));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;
        message.Body = new TextPart("plain") { Text = body };

        var messageId = MimeUtils.GenerateMessageId();
        message.MessageId = messageId;

        if (!string.IsNullOrWhiteSpace(inReplyTo))
            message.InReplyTo = inReplyTo;

        if (!string.IsNullOrWhiteSpace(references))
        {
            foreach (var id in references.Split(' ', StringSplitOptions.RemoveEmptyEntries))
                message.References.Add(id);
        }

        using var client = new SmtpClient();
        await client.ConnectAsync(_settings.SmtpHost, _settings.SmtpPort, MailKit.Security.SecureSocketOptions.None);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);

        return messageId;
    }

    public async Task<List<InboundEmail>> FetchNewAsync()
    {
        var results = new List<InboundEmail>();

        var list = await httpClient.GetFromJsonAsync<MailpitListResponse>("/api/v1/messages?limit=100", JsonOptions);
        if (list is null) return results;

        var unreadIds = list.Messages.Where(m => !m.Read).Select(m => m.ID).ToList();

        foreach (var id in unreadIds)
        {
            try
            {
                var detail = await httpClient.GetFromJsonAsync<MailpitMessageDetail>($"/api/v1/message/{id}", JsonOptions);
                if (detail is null) continue;

                var rawHeaders = await httpClient.GetFromJsonAsync<Dictionary<string, List<string>>>($"/api/v1/message/{id}/headers", JsonOptions)
                    ?? [];
                var headers = new Dictionary<string, List<string>>(rawHeaders, StringComparer.OrdinalIgnoreCase);

                results.Add(new InboundEmail(
                    MessageId: detail.MessageID,
                    From: detail.From is not null ? $"{detail.From.Name} <{detail.From.Address}>" : string.Empty,
                    To: string.Join(", ", detail.To.Select(a => a.Address)),
                    Subject: detail.Subject ?? string.Empty,
                    Body: !string.IsNullOrWhiteSpace(detail.Text) ? detail.Text : detail.HTML ?? string.Empty,
                    InReplyTo: GetFirstNormalizedHeader(headers, "In-Reply-To"),
                    References: GetAllNormalizedHeaderValues(headers, "References"),
                    ReceivedAt: detail.Date.ToUniversalTime()
                ));

                // "Seen" jelölés a Mailpit HTTP API-val — az IMAP SetFlags(Seen) megfelelője ezen a transporton.
                await httpClient.PutAsJsonAsync("/api/v1/messages", new { read = true, IDs = new[] { id } });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Hiba történt a(z) {Id} azonosítójú email lekérése közben, kihagyva.", id);
            }
        }

        return results;
    }

    private static string? GetFirstNormalizedHeader(Dictionary<string, List<string>> headers, string name) =>
        headers.TryGetValue(name, out var values) && values.Count > 0
            ? NormalizeMessageId(values[0])
            : null;

    private static string? GetAllNormalizedHeaderValues(Dictionary<string, List<string>> headers, string name)
    {
        if (!headers.TryGetValue(name, out var values) || values.Count == 0) return null;

        var ids = values
            .SelectMany(v => v.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            .Select(NormalizeMessageId);

        return string.Join(' ', ids);
    }

    private static string NormalizeMessageId(string raw) => raw.Trim().Trim('<', '>');

    private record MailpitListResponse(int Unread, List<MailpitMessageSummary> Messages);
    private record MailpitMessageSummary(string ID, bool Read);
    private record MailpitAddress(string Name, string Address);
    private record MailpitMessageDetail(string MessageID, MailpitAddress? From, List<MailpitAddress> To, string? Subject, string? Text, string? HTML, DateTime Date);
}
