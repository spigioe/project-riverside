using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Users;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;

namespace SupportPortal.Infrastructure.Services;

public class UserService(AppDbContext db) : IUserService
{
    public async Task<IReadOnlyList<UserSummaryDto>> GetActiveUsersAsync()
    {
        return await db.Users
            .AsNoTracking()
            .Where(u => u.IsActive)
            .OrderBy(u => u.FullName)
            .Select(u => new UserSummaryDto(u.Id, u.FullName, u.Email, u.Role.Name.ToString()))
            .ToListAsync();
    }
}
