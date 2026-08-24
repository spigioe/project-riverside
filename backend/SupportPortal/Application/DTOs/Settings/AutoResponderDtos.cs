namespace SupportPortal.Application.DTOs.Settings;

public record AutoResponderDto(int Id, string Trigger, string SubjectTemplate, string BodyTemplate, bool IsEnabled);
public record UpdateAutoResponderRequest(string SubjectTemplate, string BodyTemplate, bool IsEnabled);
