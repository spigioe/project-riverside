namespace SupportPortal.Application.DTOs.Sla;

public record SlaFreezeStatusDto(string StatusKey, bool FreezeEnabled);
public record UpdateSlaFreezeStatusesRequest(List<SlaFreezeStatusDto> Statuses);
