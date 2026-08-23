using SupportPortal.Application.DTOs.Common;
using SupportPortal.Application.DTOs.Companies;

namespace SupportPortal.Application.Interfaces;

public enum CompanyDeleteResult { Success, NotFound, HasContacts }
public enum CompanySaveResult { Success, DomainTaken }

public interface ICompanyService
{
    Task<PagedResult<CompanyDto>> GetCompaniesAsync(CompanyListQuery query);
    Task<IReadOnlyList<CompanyDto>> GetAllAsync();
    Task<CompanyDetailDto?> GetByIdAsync(int id);
    Task<(CompanySaveResult Result, CompanyDto? Company)> CreateAsync(CreateCompanyRequest request);
    Task<CompanySaveResult> UpdateAsync(int id, UpdateCompanyRequest request);
    Task<CompanyDeleteResult> DeleteAsync(int id);
    Task<int?> FindCompanyIdForEmailDomainAsync(string email);
}
