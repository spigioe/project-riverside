using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Sla;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public class SlaService(AppDbContext db) : ISlaService
{
    public async Task<IReadOnlyList<SlaPolicyDto>> GetAllAsync()
    {
        var policies = await db.SlaPolicies
            .AsNoTracking()
            .Include(p => p.Priorities)
            .Include(p => p.Companies)
            .OrderByDescending(p => p.IsDefault)
            .ThenBy(p => p.Name)
            .ToListAsync();

        return policies.Select(MapToDto).ToList();
    }

    public async Task<SlaPolicyDto?> GetByIdAsync(int id)
    {
        var policy = await db.SlaPolicies
            .AsNoTracking()
            .Include(p => p.Priorities)
            .Include(p => p.Companies)
            .FirstOrDefaultAsync(p => p.Id == id);

        return policy is null ? null : MapToDto(policy);
    }

    public async Task<(CreateSlaPolicyResult Result, SlaPolicyDto? Policy)> CreateAsync(CreateSlaPolicyRequest request)
    {
        if (request.IsDefault && await db.SlaPolicies.AnyAsync(p => p.IsDefault))
            return (CreateSlaPolicyResult.DefaultAlreadyExists, null);

        foreach (var companyId in request.CompanyIds)
        {
            if (!await db.Companies.AnyAsync(c => c.Id == companyId))
                return (CreateSlaPolicyResult.CompanyNotFound, null);
        }

        var policy = new SlaPolicy
        {
            Name = request.Name.Trim(),
            IsDefault = request.IsDefault,
            BusinessHoursOnly = request.BusinessHoursOnly,
        };
        db.SlaPolicies.Add(policy);
        await db.SaveChangesAsync();

        foreach (var p in request.Priorities)
        {
            db.SlaPolicyPriorities.Add(new SlaPolicyPriority
            {
                SlaPolicyId = policy.Id,
                Priority = p.Priority,
                ResponseTimeMinutes = p.ResponseTimeMinutes,
                ResolutionTimeMinutes = p.ResolutionTimeMinutes,
            });
        }

        foreach (var companyId in request.CompanyIds)
        {
            db.SlaPolicyCompanies.Add(new SlaPolicyCompany
            {
                SlaPolicyId = policy.Id,
                CompanyId = companyId,
            });
        }

        await db.SaveChangesAsync();

        var created = await db.SlaPolicies
            .AsNoTracking()
            .Include(p => p.Priorities)
            .Include(p => p.Companies)
            .FirstAsync(p => p.Id == policy.Id);

        return (CreateSlaPolicyResult.Success, MapToDto(created));
    }

    public async Task<UpdateSlaPolicyResult> UpdateAsync(int id, UpdateSlaPolicyRequest request)
    {
        var policy = await db.SlaPolicies
            .Include(p => p.Priorities)
            .Include(p => p.Companies)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (policy is null) return UpdateSlaPolicyResult.NotFound;

        foreach (var companyId in request.CompanyIds)
        {
            if (!await db.Companies.AnyAsync(c => c.Id == companyId))
                return UpdateSlaPolicyResult.CompanyNotFound;
        }

        policy.Name = request.Name.Trim();
        policy.BusinessHoursOnly = request.BusinessHoursOnly;
        policy.UpdatedAt = DateTime.UtcNow;

        db.SlaPolicyPriorities.RemoveRange(policy.Priorities);
        db.SlaPolicyCompanies.RemoveRange(policy.Companies);

        foreach (var p in request.Priorities)
        {
            db.SlaPolicyPriorities.Add(new SlaPolicyPriority
            {
                SlaPolicyId = policy.Id,
                Priority = p.Priority,
                ResponseTimeMinutes = p.ResponseTimeMinutes,
                ResolutionTimeMinutes = p.ResolutionTimeMinutes,
            });
        }

        foreach (var companyId in request.CompanyIds)
        {
            db.SlaPolicyCompanies.Add(new SlaPolicyCompany
            {
                SlaPolicyId = policy.Id,
                CompanyId = companyId,
            });
        }

        await db.SaveChangesAsync();
        return UpdateSlaPolicyResult.Success;
    }

    public async Task<DeleteSlaPolicyResult> DeleteAsync(int id)
    {
        var policy = await db.SlaPolicies.FirstOrDefaultAsync(p => p.Id == id);
        if (policy is null) return DeleteSlaPolicyResult.NotFound;
        if (policy.IsDefault) return DeleteSlaPolicyResult.CannotDeleteDefault;

        db.SlaPolicies.Remove(policy);
        await db.SaveChangesAsync();
        return DeleteSlaPolicyResult.Success;
    }

    public async Task<(int ResponseTimeMinutes, bool BusinessHoursOnly)?> FindPolicyForTicketAsync(
        string requesterEmail, TicketPriority priority)
    {
        var domain = requesterEmail.Contains('@')
            ? requesterEmail.Split('@')[1].ToLowerInvariant()
            : null;

        SlaPolicy? policy = null;

        if (domain is not null)
        {
            var company = await db.Companies
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Domain != null && c.Domain.ToLower() == domain);

            if (company is not null)
            {
                policy = await db.SlaPolicies
                    .AsNoTracking()
                    .Include(p => p.Priorities)
                    .Include(p => p.Companies)
                    .FirstOrDefaultAsync(p => p.Companies.Any(c => c.CompanyId == company.Id));
            }
        }

        policy ??= await db.SlaPolicies
            .AsNoTracking()
            .Include(p => p.Priorities)
            .FirstOrDefaultAsync(p => p.IsDefault);

        if (policy is null) return null;

        var priorityKey = priority.ToString();
        var row = policy.Priorities.FirstOrDefault(p => p.Priority == priorityKey);
        if (row is null) return null;

        return (row.ResponseTimeMinutes, policy.BusinessHoursOnly);
    }

    public async Task<IReadOnlyList<BusinessHoursDayDto>> GetBusinessHoursAsync()
    {
        var configured = await db.BusinessHours.AsNoTracking().ToListAsync();
        var byDay = configured.ToDictionary(b => b.DayOfWeek);

        return Enum.GetValues<DayOfWeek>()
            .OrderBy(d => ((int)d + 6) % 7)
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

    private static SlaPolicyDto MapToDto(SlaPolicy p) => new(
        p.Id,
        p.Name,
        p.IsDefault,
        p.BusinessHoursOnly,
        p.CreatedAt,
        p.UpdatedAt,
        p.Priorities.OrderBy(r => r.Priority).Select(r => new SlaPriorityRowDto(
            r.Priority, r.ResponseTimeMinutes, r.ResolutionTimeMinutes)).ToList(),
        p.Companies.Select(c => c.CompanyId).ToList()
    );
}
