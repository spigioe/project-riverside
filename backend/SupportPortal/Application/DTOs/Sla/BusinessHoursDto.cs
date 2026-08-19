namespace SupportPortal.Application.DTOs.Sla;

public record BusinessHoursDayDto(DayOfWeek DayOfWeek, bool IsEnabled, TimeOnly? StartTime, TimeOnly? EndTime);

public record UpdateBusinessHoursRequest(IReadOnlyList<BusinessHoursDayDto> Days);
