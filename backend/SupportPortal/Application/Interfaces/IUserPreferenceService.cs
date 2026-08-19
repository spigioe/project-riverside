using SupportPortal.Application.DTOs.UserPreferences;

namespace SupportPortal.Application.Interfaces;

public interface IUserPreferenceService
{
    Task<UserPreferenceDto> GetAsync(int userId);
    Task<UserPreferenceDto> UpdateAsync(int userId, UpdateUserPreferenceRequest request);
}
