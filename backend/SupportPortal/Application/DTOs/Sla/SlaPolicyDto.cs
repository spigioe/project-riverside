using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Sla;

public record SlaPolicyDto(
    int Id,
    string Name,
    TicketPriority Priority,
    bool IsDefault,
    bool BusinessHoursOnly,
    int ResponseTimeMinutes,
    int ResolutionTimeMinutes
);
