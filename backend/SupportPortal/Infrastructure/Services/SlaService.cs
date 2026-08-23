using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Sla;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public class SlaService(AppDbContext db) : ISlaService
{
    public async Task<IReadOnlyList<SlaPolicyDto>> GetPoliciesAsync()
    {
        return await db.SlaPolicies
            .AsNoTracking()
            .OrderBy(p => p.Priority)
            .Select(p => new SlaPolicyDto(
                p.Id, p.Name, p.Priority, p.IsDefault, p.BusinessHoursOnly,
                p.ResponseTimeMinutes, p.ResolutionTimeMinutes))
            .ToListAsync();
    }

    public async Task<UpdateSlaPolicyResult> UpdatePolicyAsync(int id, UpdateSlaPolicyRequest request)
    {
        var policy = await db.SlaPolicies.FirstOrDefaultAsync(p => p.Id == id);
        if (policy is null) return UpdateSlaPolicyResult.NotFound;

        policy.ResponseTimeMinutes = request.ResponseTimeMinutes;
        policy.ResolutionTimeMinutes = request.ResolutionTimeMinutes;
        policy.BusinessHoursOnly = request.BusinessHoursOnly;

        await db.SaveChangesAsync();
        return UpdateSlaPolicyResult.Success;
    }

    public async Task<IReadOnlyList<SlaDomainDto>> GetDomainsAsync()
    {
        return await db.SlaPolicyDomains
            .AsNoTracking()
            .OrderBy(d => d.EmailDomain)
            .Select(d => new SlaDomainDto(d.Id, d.SlaPolicyId, d.SlaPolicy.Name, d.EmailDomain))
            .ToListAsync();
    }

    public async Task<(CreateSlaDomainResult Result, SlaDomainDto? Domain)> CreateDomainAsync(CreateSlaDomainRequest request)
    {
        var policy = await db.SlaPolicies.FirstOrDefaultAsync(p => p.Id == request.SlaPolicyId);
        if (policy is null) return (CreateSlaDomainResult.PolicyNotFound, null);

        var normalizedDomain = request.EmailDomain.Trim().ToLowerInvariant();
        var domainTaken = await db.SlaPolicyDomains.AnyAsync(d => d.EmailDomain == normalizedDomain);
        if (domainTaken) return (CreateSlaDomainResult.DomainTaken, null);

        var entity = new SlaPolicyDomain { SlaPolicyId = request.SlaPolicyId, EmailDomain = normalizedDomain };
        db.SlaPolicyDomains.Add(entity);
        await db.SaveChangesAsync();

        return (CreateSlaDomainResult.Success, new SlaDomainDto(entity.Id, policy.Id, policy.Name, entity.EmailDomain));
    }

    public async Task<bool> DeleteDomainAsync(int id)
    {
        var domain = await db.SlaPolicyDomains.FirstOrDefaultAsync(d => d.Id == id);
        if (domain is null) return false;

        db.SlaPolicyDomains.Remove(domain);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<IReadOnlyList<BusinessHoursDayDto>> GetBusinessHoursAsync()
    {
        var configured = await db.BusinessHours.AsNoTracking().ToListAsync();
        var byDay = configured.ToDictionary(b => b.DayOfWeek);

        return Enum.GetValues<DayOfWeek>()
            .OrderBy(d => ((int)d + 6) % 7) // hétfővel kezdve (H-V)
            .Select(d => byDay.TryGetValue(d, out var bh)
                ? new BusinessHoursDayDto(d, true, bh.StartTime, bh.EndTime)
                : new BusinessHoursDayDto(d, false, null, null))
            .ToList();
    }

    public async Task<IReadOnlyList<BusinessHoursDayDto>> UpdateBusinessHoursAsync(UpdateBusinessHoursRequest request)
    {
        var existing = await db.BusinessHours.ToListAsync();
        var byDay = existing.ToDictionary(b => b.DayOfWeek);

        foreach (var day in request.Days)
        {
            if (day.IsEnabled && day.StartTime.HasValue && day.EndTime.HasValue)
            {
                if (byDay.TryGetValue(day.DayOfWeek, out var bh))
                {
                    bh.StartTime = day.StartTime.Value;
                    bh.EndTime = day.EndTime.Value;
                }
                else
                {
                    db.BusinessHours.Add(new BusinessHours
                    {
                        DayOfWeek = day.DayOfWeek,
                        StartTime = day.StartTime.Value,
                        EndTime = day.EndTime.Value,
                    });
                }
            }
            else if (byDay.TryGetValue(day.DayOfWeek, out var bh))
            {
                db.BusinessHours.Remove(bh);
            }
        }

        await db.SaveChangesAsync();
        return await GetBusinessHoursAsync();
    }

    public async Task<DateTime?> CalculateSlaDueAtAsync(TicketPriority priority, DateTime createdAt)
    {
        var policy = await db.SlaPolicies
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Priority == priority);

        if (policy is null) return null;

        if (!policy.BusinessHoursOnly)
            return createdAt.AddMinutes(policy.ResponseTimeMinutes);

        var schedule = await db.BusinessHours.AsNoTracking().ToListAsync();
        if (schedule.Count == 0)
            return createdAt.AddMinutes(policy.ResponseTimeMinutes);

        return AddWorkingMinutes(createdAt, policy.ResponseTimeMinutes, schedule);
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
