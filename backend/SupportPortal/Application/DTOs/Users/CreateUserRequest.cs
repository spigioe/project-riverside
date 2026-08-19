namespace SupportPortal.Application.DTOs.Users;

public record CreateUserRequest(
    string Email,
    string FullName,
    int RoleId,
    string Password
);
