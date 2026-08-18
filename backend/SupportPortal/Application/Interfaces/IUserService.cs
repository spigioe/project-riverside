using SupportPortal.Application.DTOs.Users;

namespace SupportPortal.Application.Interfaces;

public interface IUserService
{
    Task<IReadOnlyList<UserSummaryDto>> GetActiveUsersAsync();
}
