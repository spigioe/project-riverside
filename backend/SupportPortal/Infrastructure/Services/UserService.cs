using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Users;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;

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

    public async Task<IReadOnlyList<UserAdminDto>> GetAllUsersAsync()
    {
        return await db.Users
            .AsNoTracking()
            .OrderBy(u => u.FullName)
            .Select(u => new UserAdminDto(
                u.Id, u.Email, u.FullName, u.RoleId, u.Role.Name,
                u.IsActive, u.CreatedAt, u.LastLoginAt))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<RoleDto>> GetRolesAsync()
    {
        return await db.Roles
            .AsNoTracking()
            .OrderBy(r => r.Id)
            .Select(r => new RoleDto(r.Id, r.Name))
            .ToListAsync();
    }

    public async Task<(CreateUserResult Result, UserAdminDto? User)> CreateUserAsync(CreateUserRequest request)
    {
        var emailTaken = await db.Users.AnyAsync(u => u.Email == request.Email);
        if (emailTaken) return (CreateUserResult.EmailTaken, null);

        var roleExists = await db.Roles.AnyAsync(r => r.Id == request.RoleId);
        if (!roleExists) return (CreateUserResult.RoleNotFound, null);

        var user = new User
        {
            Email = request.Email,
            FullName = request.FullName,
            RoleId = request.RoleId,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsActive = true,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        var created = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == user.Id)
            .Select(u => new UserAdminDto(
                u.Id, u.Email, u.FullName, u.RoleId, u.Role.Name,
                u.IsActive, u.CreatedAt, u.LastLoginAt))
            .FirstAsync();

        return (CreateUserResult.Success, created);
    }

    public async Task<UpdateUserResult> UpdateUserAsync(int id, UpdateUserRequest request)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return UpdateUserResult.UserNotFound;

        var roleExists = await db.Roles.AnyAsync(r => r.Id == request.RoleId);
        if (!roleExists) return UpdateUserResult.RoleNotFound;

        user.FullName = request.FullName;
        user.RoleId = request.RoleId;
        user.IsActive = request.IsActive;

        await db.SaveChangesAsync();
        return UpdateUserResult.Success;
    }

    public async Task<bool> DeactivateUserAsync(int id)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return false;

        user.IsActive = false;
        await db.SaveChangesAsync();
        return true;
    }
}
