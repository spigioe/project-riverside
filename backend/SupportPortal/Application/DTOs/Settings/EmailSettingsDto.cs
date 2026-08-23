namespace SupportPortal.Application.DTOs.Settings;

public record EmailSettingsDto(
    string Provider,
    string SmtpHost,
    int SmtpPort,
    string? ApiBaseUrl,
    string ImapHost,
    int ImapPort,
    bool UseSsl,
    string Username,
    /// <summary>Mindig "••••••••" — a valódi jelszó soha nem kerül ki a kliensre.</summary>
    string PasswordMasked,
    int PollIntervalSeconds,
    string FromAddress,
    bool HasStoredConfig
);

public record UpdateEmailSettingsRequest(
    string Provider,
    string SmtpHost,
    int SmtpPort,
    string? ApiBaseUrl,
    string ImapHost,
    int ImapPort,
    bool UseSsl,
    string Username,
    /// <summary>Ha üres string érkezik, a tárolt jelszót tartjuk meg.</summary>
    string Password,
    int PollIntervalSeconds,
    string FromAddress
);

public record TestEmailConnectionRequest(
    string Provider,
    string SmtpHost,
    int SmtpPort,
    string? ApiBaseUrl,
    string ImapHost,
    int ImapPort,
    bool UseSsl,
    string Username,
    string Password,
    string FromAddress
);

public record TestEmailConnectionResponse(bool Success, string Message);
