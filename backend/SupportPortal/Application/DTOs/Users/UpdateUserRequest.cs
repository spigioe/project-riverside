namespace SupportPortal.Application.DTOs.Users;

public record UpdateUserRequest(
    string FullName,
    int RoleId,
    bool IsActive
);
