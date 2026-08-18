using SupportPortal.Application.DTOs.Auth;

namespace SupportPortal.Application.Interfaces;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request);
    Task<LoginResponse?> RefreshAsync(string refreshToken);
    Task RevokeAsync(string refreshToken);
}
