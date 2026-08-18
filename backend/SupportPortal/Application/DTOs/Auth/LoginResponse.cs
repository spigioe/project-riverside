namespace SupportPortal.Application.DTOs.Auth;

public record LoginResponse(
    string AccessToken,
    string RefreshToken,
    DateTime AccessTokenExpires,
    UserDto User
);

public record UserDto(int Id, string Email, string FullName, string Role);
