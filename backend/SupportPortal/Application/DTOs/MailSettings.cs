namespace SupportPortal.Application.DTOs;

public class MailSettings
{
    /// <summary>"mailpit" (fejlesztői) vagy "imap" (Gmail / egyéb valódi postafiók)</summary>
    public string Provider { get; set; } = "mailpit";

    public string SmtpHost { get; set; } = null!;
    public int SmtpPort { get; set; }

    /// <summary>Mailpit HTTP API base URL-je — csak Provider == "mailpit" esetén használt.</summary>
    public string ApiBaseUrl { get; set; } = null!;

    /// <summary>IMAP szerver — csak Provider == "imap" esetén használt.</summary>
    public string ImapHost { get; set; } = "imap.gmail.com";
    public int ImapPort { get; set; } = 993;
    public bool UseSsl { get; set; } = true;

    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;

    public int PollIntervalSeconds { get; set; } = 60;
    public string FromAddress { get; set; } = "support@supportportal.dev";
}
