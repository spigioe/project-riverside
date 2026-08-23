namespace SupportPortal.Application.Interfaces;

public interface ISlaCalculationService
{
    Task<DateTime> CalculateDueAtAsync(DateTime createdAt, int responseTimeMinutes, bool businessHoursOnly);
}
