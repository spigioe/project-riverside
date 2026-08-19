namespace SupportPortal.Application.DTOs.Sla;

public record UpdateSlaPolicyRequest(
    int ResponseTimeMinutes,
    int ResolutionTimeMinutes,
    bool BusinessHoursOnly
);
