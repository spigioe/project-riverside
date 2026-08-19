using SupportPortal.Application.DTOs.Users;

namespace SupportPortal.Application.Interfaces;

public enum CreateUserResult { Success, EmailTaken, RoleNotFound }

public enum UpdateUserResult { Success, UserNotFound, RoleNotFound }

public interface IUserService
{
    Task<IReadOnlyList<UserSummaryDto>> GetActiveUsersAsync();
    Task<IReadOnlyList<UserAdminDto>> GetAllUsersAsync();
    Task<IReadOnlyList<RoleDto>> GetRolesAsync();
    Task<(CreateUserResult Result, UserAdminDto? User)> CreateUserAsync(CreateUserRequest request);
    Task<UpdateUserResult> UpdateUserAsync(int id, UpdateUserRequest request);
    Task<bool> DeactivateUserAsync(int id);
}
