namespace SupportPortal.Application.DTOs.Settings;

public record EmailSettingsDto(string SmtpHost, int SmtpPort, string ApiBaseUrl, int PollIntervalSeconds, string FromAddress);
