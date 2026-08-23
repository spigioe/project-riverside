using SupportPortal.Application.DTOs.Sla;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.Interfaces;

public enum CreateSlaPolicyResult { Success, DefaultAlreadyExists, CompanyNotFound }
public enum UpdateSlaPolicyResult { Success, NotFound, CompanyNotFound }
public enum DeleteSlaPolicyResult { Success, NotFound, CannotDeleteDefault }

public interface ISlaService
{
    Task<IReadOnlyList<SlaPolicyDto>> GetAllAsync();
    Task<SlaPolicyDto?> GetByIdAsync(int id);
    Task<(CreateSlaPolicyResult Result, SlaPolicyDto? Policy)> CreateAsync(CreateSlaPolicyRequest request);
    Task<UpdateSlaPolicyResult> UpdateAsync(int id, UpdateSlaPolicyRequest request);
    Task<DeleteSlaPolicyResult> DeleteAsync(int id);

    Task<(int ResponseTimeMinutes, bool BusinessHoursOnly)?> FindPolicyForTicketAsync(string requesterEmail, TicketPriority priority);

    Task<IReadOnlyList<BusinessHoursDayDto>> GetBusinessHoursAsync();
    Task<IReadOnlyList<BusinessHoursDayDto>> UpdateBusinessHoursAsync(UpdateBusinessHoursRequest request);
}
