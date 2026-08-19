using SupportPortal.Application.DTOs.Sla;

namespace SupportPortal.Application.Interfaces;

public enum UpdateSlaPolicyResult { Success, NotFound }

public enum CreateSlaDomainResult { Success, PolicyNotFound, DomainTaken }

public interface ISlaService
{
    Task<IReadOnlyList<SlaPolicyDto>> GetPoliciesAsync();
    Task<UpdateSlaPolicyResult> UpdatePolicyAsync(int id, UpdateSlaPolicyRequest request);
    Task<IReadOnlyList<SlaDomainDto>> GetDomainsAsync();
    Task<(CreateSlaDomainResult Result, SlaDomainDto? Domain)> CreateDomainAsync(CreateSlaDomainRequest request);
    Task<bool> DeleteDomainAsync(int id);
    Task<IReadOnlyList<BusinessHoursDayDto>> GetBusinessHoursAsync();
    Task<IReadOnlyList<BusinessHoursDayDto>> UpdateBusinessHoursAsync(UpdateBusinessHoursRequest request);
}
