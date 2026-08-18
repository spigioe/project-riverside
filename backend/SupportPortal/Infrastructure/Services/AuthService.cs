using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SupportPortal.Application.DTOs.Auth;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Infrastructure.Services;

public class AuthService(AppDbContext db, IOptions<JwtSettings> jwtOptions) : IAuthService
{
    private readonly JwtSettings _jwt = jwtOptions.Value;

    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        var user = await db.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.IsActive);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return null;

        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var accessToken = GenerateAccessToken(user);
        var refreshToken = await GenerateRefreshTokenAsync(user.Id, request.RememberMe);

        return new LoginResponse(
            accessToken.Token,
            refreshToken,
            accessToken.Expires,
            new UserDto(user.Id, user.Email, user.FullName, user.Role.Name.ToString())
        );
    }

    public async Task<LoginResponse?> RefreshAsync(string refreshToken)
    {
        var stored = await db.RefreshTokens
            .Include(r => r.User).ThenInclude(u => u.Role)
            .FirstOrDefaultAsync(r => r.Token == refreshToken && !r.IsRevoked);

        if (stored is null || stored.ExpiresAt < DateTime.UtcNow)
            return null;

        // Rotate: revoke old, issue new
        stored.IsRevoked = true;
        stored.RevokedAt = DateTime.UtcNow;

        var accessToken = GenerateAccessToken(stored.User);
        var newRefresh = await GenerateRefreshTokenAsync(stored.User.Id, isLongLived: false);
        await db.SaveChangesAsync();

        return new LoginResponse(
            accessToken.Token,
            newRefresh,
            accessToken.Expires,
            new UserDto(stored.User.Id, stored.User.Email, stored.User.FullName, stored.User.Role.Name.ToString())
        );
    }

    public async Task RevokeAsync(string refreshToken)
    {
        var stored = await db.RefreshTokens
            .FirstOrDefaultAsync(r => r.Token == refreshToken && !r.IsRevoked);

        if (stored is null) return;

        stored.IsRevoked = true;
        stored.RevokedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private (string Token, DateTime Expires) GenerateAccessToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(_jwt.AccessTokenMinutes);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.Name.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims: claims,
            expires: expires,
            signingCredentials: creds
        );

        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    private async Task<string> GenerateRefreshTokenAsync(int userId, bool isLongLived)
    {
        var tokenBytes = RandomNumberGenerator.GetBytes(64);
        var token = Convert.ToBase64String(tokenBytes);

        var days = isLongLived
            ? _jwt.RefreshTokenRememberMeDays
            : _jwt.RefreshTokenDays;

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = userId,
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddDays(days)
        });

        await db.SaveChangesAsync();
        return token;
    }
}
