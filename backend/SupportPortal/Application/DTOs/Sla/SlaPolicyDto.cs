namespace SupportPortal.Application.DTOs.Sla;

public record SlaPolicyDto(
    int Id,
    string Name,
    bool IsDefault,
    bool BusinessHoursOnly,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<SlaPriorityRowDto> Priorities,
    IReadOnlyList<int> CompanyIds
);
