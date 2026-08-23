using SupportPortal.Application.DTOs.CustomStatuses;

namespace SupportPortal.Application.Interfaces;

public enum CustomStatusSaveResult { Success, KeyTaken, NotFound }

public interface ICustomStatusService
{
    Task<IReadOnlyList<CustomStatusDto>> GetAllAsync();
    Task<CustomStatusDto?> GetByIdAsync(int id);
    Task<(CustomStatusSaveResult Result, CustomStatusDto? Dto)> CreateAsync(CreateCustomStatusRequest request);
    Task<CustomStatusSaveResult> UpdateAsync(int id, UpdateCustomStatusRequest request);
    Task<bool> DeleteAsync(int id);
    Task<bool> KeyExistsAsync(string key);
}
