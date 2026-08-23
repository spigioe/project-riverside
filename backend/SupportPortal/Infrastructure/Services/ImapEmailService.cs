using MailKit;
using MailKit.Net.Imap;
using MailKit.Net.Smtp;
using MailKit.Search;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using MimeKit;
using MimeKit.Utils;
using SupportPortal.Application.DTOs;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Infrastructure.Services;

/// <summary>
/// Valódi IMAP + SMTP implementáció (Gmail / bármely IMAP-kompatibilis postafiók).
/// A bejövő emaileket IMAP UNSEEN keresés hívja le, majd SEEN-nek jelöli.
/// A kimenő küldés SMTP-n megy (Gmail esetén 587/STARTTLS vagy 465/SSL).
/// </summary>
public class ImapEmailService(MailSettings settings, ILogger<ImapEmailService> logger) : IEmailService
{
    public async Task<string> SendAsync(string to, string subject, string body, string? inReplyTo, string? references, string? cc = null, string? bcc = null)
    {
        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(settings.FromAddress));
        message.To.Add(MailboxAddress.Parse(to));
        AddAddresses(message.Cc, cc);
        AddAddresses(message.Bcc, bcc);
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = body };

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
        var sslOption = settings.UseSsl
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTlsWhenAvailable;

        await client.ConnectAsync(settings.SmtpHost, settings.SmtpPort, sslOption);

        if (!string.IsNullOrWhiteSpace(settings.Username))
            await client.AuthenticateAsync(settings.Username, settings.Password);

        await client.SendAsync(message);
        await client.DisconnectAsync(true);

        return messageId;
    }

    public async Task<List<InboundEmail>> FetchNewAsync()
    {
        var results = new List<InboundEmail>();

        using var client = new ImapClient();

        try
        {
            var sslOption = settings.UseSsl
                ? SecureSocketOptions.SslOnConnect
                : SecureSocketOptions.StartTlsWhenAvailable;

            await client.ConnectAsync(settings.ImapHost, settings.ImapPort, sslOption);
            await client.AuthenticateAsync(settings.Username, settings.Password);

            var inbox = client.Inbox;
            await inbox.OpenAsync(FolderAccess.ReadWrite);

            var uids = await inbox.SearchAsync(SearchQuery.NotSeen);
            if (uids.Count == 0)
            {
                await client.DisconnectAsync(true);
                return results;
            }

            var messages = await inbox.FetchAsync(uids, MessageSummaryItems.UniqueId | MessageSummaryItems.Envelope | MessageSummaryItems.Body);

            foreach (var summary in messages)
            {
                try
                {
                    var mimeMessage = await inbox.GetMessageAsync(summary.UniqueId);

                    var from = mimeMessage.From.Mailboxes.FirstOrDefault();
                    var fromStr = from is not null ? $"{from.Name} <{from.Address}>" : string.Empty;
                    var toStr = string.Join(", ", mimeMessage.To.Mailboxes.Select(m => m.Address));

                    var bodyText = mimeMessage.HtmlBody ?? mimeMessage.TextBody ?? string.Empty;

                    var attachments = new List<InboundEmailAttachment>();
                    foreach (var attachment in mimeMessage.Attachments)
                    {
                        if (attachment is MimePart part && part.Content is not null)
                        {
                            using var ms = new MemoryStream();
                            await part.Content.DecodeToAsync(ms);
                            attachments.Add(new InboundEmailAttachment(
                                part.FileName ?? "attachment",
                                part.ContentType.MimeType,
                                ms.ToArray()));
                        }
                    }

                    var inReplyTo = string.IsNullOrWhiteSpace(mimeMessage.InReplyTo)
                        ? null
                        : mimeMessage.InReplyTo.Trim('<', '>');

                    var referencesStr = mimeMessage.References.Count > 0
                        ? string.Join(' ', mimeMessage.References.Select(r => r.Trim('<', '>')))
                        : null;

                    results.Add(new InboundEmail(
                        MessageId: mimeMessage.MessageId ?? Guid.NewGuid().ToString(),
                        From: fromStr,
                        To: toStr,
                        Subject: mimeMessage.Subject ?? string.Empty,
                        Body: bodyText,
                        InReplyTo: inReplyTo,
                        References: referencesStr,
                        ReceivedAt: (mimeMessage.Date == DateTimeOffset.MinValue ? DateTimeOffset.UtcNow : mimeMessage.Date).UtcDateTime,
                        Attachments: attachments
                    ));

                    await inbox.AddFlagsAsync(summary.UniqueId, MessageFlags.Seen, true);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Hiba a(z) {Uid} üzenet feldolgozásakor, kihagyva.", summary.UniqueId);
                }
            }

            await client.DisconnectAsync(true);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "IMAP kapcsolódási hiba ({Host}:{Port}).", settings.ImapHost, settings.ImapPort);
            if (client.IsConnected) await client.DisconnectAsync(false);
        }

        return results;
    }

    private static void AddAddresses(InternetAddressList list, string? commaSeparated)
    {
        if (string.IsNullOrWhiteSpace(commaSeparated)) return;
        foreach (var address in commaSeparated.Split(',', StringSplitOptions.RemoveEmptyEntries))
            list.Add(MailboxAddress.Parse(address.Trim()));
    }
}
