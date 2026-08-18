namespace SupportPortal.Application.DTOs.Auth;

public record LoginRequest(string Email, string Password, bool RememberMe = false);
