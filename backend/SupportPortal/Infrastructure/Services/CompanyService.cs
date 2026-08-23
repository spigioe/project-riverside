using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Common;
using SupportPortal.Application.DTOs.Companies;
using SupportPortal.Application.DTOs.Contacts;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Infrastructure.Services;

public class CompanyService(AppDbContext db) : ICompanyService
{
    public async Task<PagedResult<CompanyDto>> GetCompaniesAsync(CompanyListQuery query)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 100 ? 25 : query.PageSize;

        var q = db.Companies.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim();
            q = q.Where(c => c.Name.Contains(s) || (c.Domain != null && c.Domain.Contains(s)));
        }

        var total = await q.CountAsync();

        // Pomelo GroupBy bug elkerülése: ToListAsync() + in-memory map
        var companies = await q
            .OrderBy(c => c.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(c => c.Contacts)
            .ToListAsync();

        var items = companies.Select(c => MapToDto(c, c.Contacts.Count)).ToList();
        return new PagedResult<CompanyDto>(items, page, pageSize, total);
    }

    public async Task<IReadOnlyList<CompanyDto>> GetAllAsync()
    {
        var companies = await db.Companies
            .AsNoTracking()
            .Include(c => c.Contacts)
            .OrderBy(c => c.Name)
            .ToListAsync();

        return companies.Select(c => MapToDto(c, c.Contacts.Count)).ToList();
    }

    public async Task<CompanyDetailDto?> GetByIdAsync(int id)
    {
        var company = await db.Companies
            .AsNoTracking()
            .Include(c => c.Contacts)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (company is null) return null;

        var contacts = company.Contacts.Select(c => new ContactDto(
            c.Id, c.Email, c.Name, c.CompanyId, company.Name, c.IsActive, c.CreatedAt, c.UpdatedAt))
            .OrderBy(c => c.Name)
            .ToList();

        return new CompanyDetailDto(company.Id, company.Name, company.Domain, company.CreatedAt, contacts);
    }

    public async Task<(CompanySaveResult Result, CompanyDto? Company)> CreateAsync(CreateCompanyRequest request)
    {
        var normalizedDomain = NormalizeDomain(request.Domain);

        if (normalizedDomain is not null && await db.Companies.AnyAsync(c => c.Domain == normalizedDomain))
            return (CompanySaveResult.DomainTaken, null);

        var company = new Company
        {
            Name = request.Name.Trim(),
            Domain = normalizedDomain,
        };
        db.Companies.Add(company);
        await db.SaveChangesAsync();

        return (CompanySaveResult.Success, MapToDto(company, 0));
    }

    public async Task<CompanySaveResult> UpdateAsync(int id, UpdateCompanyRequest request)
    {
        var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == id);
        if (company is null) return CompanySaveResult.DomainTaken; // misuse but NotFound handled at controller

        var normalizedDomain = NormalizeDomain(request.Domain);

        if (normalizedDomain is not null
            && await db.Companies.AnyAsync(c => c.Id != id && c.Domain == normalizedDomain))
            return CompanySaveResult.DomainTaken;

        company.Name = request.Name.Trim();
        company.Domain = normalizedDomain;
        await db.SaveChangesAsync();

        return CompanySaveResult.Success;
    }

    public async Task<CompanyDeleteResult> DeleteAsync(int id)
    {
        var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == id);
        if (company is null) return CompanyDeleteResult.NotFound;

        var hasContacts = await db.Contacts.AnyAsync(c => c.CompanyId == id);
        if (hasContacts) return CompanyDeleteResult.HasContacts;

        db.Companies.Remove(company);
        await db.SaveChangesAsync();
        return CompanyDeleteResult.Success;
    }

    public async Task<int?> FindCompanyIdForEmailDomainAsync(string email)
    {
        var domain = ExtractDomain(email);
        if (domain is null) return null;

        return await db.Companies
            .Where(c => c.Domain == domain)
            .Select(c => (int?)c.Id)
            .FirstOrDefaultAsync();
    }

    private static string? NormalizeDomain(string? domain) =>
        string.IsNullOrWhiteSpace(domain) ? null : domain.Trim().ToLowerInvariant();

    private static string? ExtractDomain(string email)
    {
        var idx = email.LastIndexOf('@');
        if (idx < 0 || idx == email.Length - 1) return null;
        return email[(idx + 1)..].Trim().ToLowerInvariant();
    }

    private static CompanyDto MapToDto(Company c, int contactCount) =>
        new(c.Id, c.Name, c.Domain, contactCount, c.CreatedAt);
}
