namespace SupportPortal.Application.DTOs.Sla;

public record CreateSlaPolicyRequest(
    string Name,
    bool IsDefault,
    bool BusinessHoursOnly,
    IReadOnlyList<SlaPriorityRowRequest> Priorities,
    IReadOnlyList<int> CompanyIds
);
