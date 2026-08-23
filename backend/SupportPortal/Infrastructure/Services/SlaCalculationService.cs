using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Infrastructure.Services;

public class SlaCalculationService(AppDbContext db) : ISlaCalculationService
{
    public async Task<DateTime> CalculateDueAtAsync(DateTime createdAt, int responseTimeMinutes, bool businessHoursOnly)
    {
        if (!businessHoursOnly)
            return createdAt.AddMinutes(responseTimeMinutes);

        var schedule = await db.BusinessHours.AsNoTracking().ToListAsync();
        if (schedule.Count == 0)
            return createdAt.AddMinutes(responseTimeMinutes);

        return AddWorkingMinutes(createdAt, responseTimeMinutes, schedule);
    }

    private static DateTime AddWorkingMinutes(DateTime start, int minutes, List<BusinessHours> schedule)
    {
        var byDay = schedule.ToDictionary(b => b.DayOfWeek);
        var current = AdvanceToWorkingTime(start, byDay);
        var remaining = minutes;

        while (remaining > 0)
        {
            if (!byDay.TryGetValue(current.DayOfWeek, out var bh))
            {
                current = NextWorkingDayStart(current, byDay);
                continue;
            }

            var dayEnd = current.Date.Add(bh.EndTime.ToTimeSpan());
            var minutesUntilEnd = (int)(dayEnd - current).TotalMinutes;

            if (minutesUntilEnd <= 0)
            {
                current = NextWorkingDayStart(current, byDay);
                continue;
            }

            if (remaining <= minutesUntilEnd)
            {
                current = current.AddMinutes(remaining);
                remaining = 0;
            }
            else
            {
                remaining -= minutesUntilEnd;
                current = NextWorkingDayStart(current, byDay);
            }
        }

        return current;
    }

    private static DateTime AdvanceToWorkingTime(DateTime dt, Dictionary<DayOfWeek, BusinessHours> byDay)
    {
        for (int i = 0; i < 14; i++)
        {
            if (!byDay.TryGetValue(dt.DayOfWeek, out var bh))
            {
                dt = dt.Date.AddDays(1);
                continue;
            }

            var dayStart = dt.Date.Add(bh.StartTime.ToTimeSpan());
            var dayEnd = dt.Date.Add(bh.EndTime.ToTimeSpan());

            if (dt < dayStart) return dayStart;
            if (dt < dayEnd) return dt;

            dt = dt.Date.AddDays(1);
        }
        return dt;
    }

    private static DateTime NextWorkingDayStart(DateTime dt, Dictionary<DayOfWeek, BusinessHours> byDay)
    {
        dt = dt.Date.AddDays(1);
        for (int i = 0; i < 14; i++)
        {
            if (byDay.TryGetValue(dt.DayOfWeek, out var bh))
                return dt.Add(bh.StartTime.ToTimeSpan());
            dt = dt.AddDays(1);
        }
        return dt;
    }
}
