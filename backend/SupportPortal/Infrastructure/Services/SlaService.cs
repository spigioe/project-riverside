using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Sla;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;

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
}
