using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Users;

public record UserAdminDto(
    int Id,
    string Email,
    string FullName,
    int RoleId,
    UserRole RoleName,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? LastLoginAt
);
