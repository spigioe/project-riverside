namespace SupportPortal.Application.DTOs.Analytics;

public record CustomerActivityItemDto(
    int? CompanyId,
    string CompanyName,
    string? Domain,
    int TicketCount);
