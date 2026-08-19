using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Csm;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public class CsmService(AppDbContext db) : ICsmService
{
    private static readonly TicketStatus[] ActiveStatuses = [TicketStatus.New, TicketStatus.Open, TicketStatus.Pending];

    public async Task<IReadOnlyList<CsmDto>> GetAllAsync()
    {
        var managers = await db.CsmManagers
            .AsNoTracking()
            .Include(c => c.Domains)
            .OrderBy(c => c.Name)
            .ToListAsync();

        return managers.Select(MapToDto).ToList();
    }

    public async Task<(CreateCsmResult Result, CsmDto? Csm)> CreateAsync(CreateCsmRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var emailTaken = await db.CsmManagers.AnyAsync(c => c.Email == normalizedEmail);
        if (emailTaken) return (CreateCsmResult.EmailTaken, null);

        var csm = new CsmManager
        {
            Name = request.Name.Trim(),
            Email = normalizedEmail,
            Domains = NormalizeDomains(request.Domains).Select(d => new CsmDomain { EmailDomain = d }).ToList(),
        };

        db.CsmManagers.Add(csm);
        await db.SaveChangesAsync();

        return (CreateCsmResult.Success, MapToDto(csm));
    }

    public async Task<UpdateCsmResult> UpdateAsync(int id, UpdateCsmRequest request)
    {
        var csm = await db.CsmManagers.Include(c => c.Domains).FirstOrDefaultAsync(c => c.Id == id);
        if (csm is null) return UpdateCsmResult.NotFound;

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var emailTaken = await db.CsmManagers.AnyAsync(c => c.Id != id && c.Email == normalizedEmail);
        if (emailTaken) return UpdateCsmResult.EmailTaken;

        csm.Name = request.Name.Trim();
        csm.Email = normalizedEmail;

        db.CsmDomains.RemoveRange(csm.Domains);
        csm.Domains = NormalizeDomains(request.Domains).Select(d => new CsmDomain { EmailDomain = d }).ToList();

        await db.SaveChangesAsync();
        return UpdateCsmResult.Success;
    }

    public async Task<DeleteCsmResult> DeleteAsync(int id)
    {
        var csm = await db.CsmManagers.FirstOrDefaultAsync(c => c.Id == id);
        if (csm is null) return DeleteCsmResult.NotFound;

        var hasActiveTickets = await db.Tickets.AnyAsync(t => t.CsmId == id && ActiveStatuses.Contains(t.Status));
        if (hasActiveTickets) return DeleteCsmResult.HasActiveTickets;

        db.CsmManagers.Remove(csm);
        await db.SaveChangesAsync();
        return DeleteCsmResult.Success;
    }

    public async Task<CsmSuggestionDto> SuggestAsync(string requesterEmail)
    {
        var domain = ExtractDomain(requesterEmail);
        if (domain is null) return new CsmSuggestionDto(null, null, null);

        var match = await db.CsmDomains
            .AsNoTracking()
            .Where(d => d.EmailDomain == domain)
            .OrderBy(d => d.Id)
            .Select(d => new { d.CsmId, d.Csm.Name, d.Csm.Email })
            .FirstOrDefaultAsync();

        return match is null
            ? new CsmSuggestionDto(null, null, null)
            : new CsmSuggestionDto(match.CsmId, match.Name, match.Email);
    }

    public async Task<int?> FindCsmIdForEmailAsync(string requesterEmail)
    {
        var domain = ExtractDomain(requesterEmail);
        if (domain is null) return null;

        return await db.CsmDomains
            .Where(d => d.EmailDomain == domain)
            .OrderBy(d => d.Id)
            .Select(d => (int?)d.CsmId)
            .FirstOrDefaultAsync();
    }

    private static IReadOnlyList<string> NormalizeDomains(IReadOnlyList<string> domains) =>
        domains
            .Select(d => d.Trim().ToLowerInvariant())
            .Where(d => !string.IsNullOrWhiteSpace(d))
            .Distinct()
            .ToList();

    private static string? ExtractDomain(string email)
    {
        var idx = email.LastIndexOf('@');
        if (idx < 0 || idx == email.Length - 1) return null;
        return email[(idx + 1)..].Trim().ToLowerInvariant();
    }

    private static CsmDto MapToDto(CsmManager c) =>
        new(c.Id, c.Name, c.Email, c.Domains.Select(d => d.EmailDomain).OrderBy(d => d).ToList(), c.CreatedAt);
}
