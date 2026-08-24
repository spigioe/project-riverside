namespace SupportPortal.Application.DTOs.Sla;

public record SlaPriorityRowRequest(
    string Priority,
    int ResponseTimeMinutes,
    int? ResolutionTimeMinutes
);

public record UpdateSlaPolicyRequest(
    string Name,
    bool IsDefault,
    bool BusinessHoursOnly,
    IReadOnlyList<SlaPriorityRowRequest> Priorities,
    IReadOnlyList<int> CompanyIds
);
