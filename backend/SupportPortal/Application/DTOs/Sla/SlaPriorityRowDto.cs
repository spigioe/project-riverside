namespace SupportPortal.Application.DTOs.Sla;

public record SlaPriorityRowDto(
    string Priority,
    int ResponseTimeMinutes,
    int? ResolutionTimeMinutes
);
