namespace SupportPortal.Application.DTOs;

public class MailSettings
{
    public string SmtpHost { get; set; } = null!;
    public int SmtpPort { get; set; }

    /// <summary>
    /// Mailpit HTTP API base URL-je (pl. http://mailpit:8025). A Mailpit nem biztosít IMAP szervert —
    /// csak SMTP-t, POP3-at és egy HTTP API-t/webes UI-t — ezért a bejövő emailek lekérdezése
    /// ezen keresztül történik IMAP helyett. Lásd EmailService.FetchNewAsync.
    /// </summary>
    public string ApiBaseUrl { get; set; } = null!;

    public int PollIntervalSeconds { get; set; } = 60;
    public string FromAddress { get; set; } = "support@supportportal.dev";
}
