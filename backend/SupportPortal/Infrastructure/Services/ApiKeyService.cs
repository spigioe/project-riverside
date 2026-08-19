using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.ApiKeys;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Infrastructure.Services;

public class ApiKeyService(AppDbContext db) : IApiKeyService
{
    public async Task<IReadOnlyList<ApiKeyDto>> GetKeysAsync()
    {
        return await db.ApiKeys
            .AsNoTracking()
            .OrderByDescending(k => k.CreatedAt)
            .Select(k => new ApiKeyDto(k.Id, k.Name, k.LastUsedAt, k.ExpiresAt, k.IsActive, k.CreatedAt))
            .ToListAsync();
    }

    public async Task<CreateApiKeyResponse> CreateKeyAsync(CreateApiKeyRequest request, int currentUserId)
    {
        var plainKey = $"sp_{Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_')}";
        var keyHash = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(plainKey)));

        var apiKey = new ApiKey
        {
            UserId = currentUserId,
            Name = request.Name,
            KeyHash = keyHash,
            ExpiresAt = request.ExpiresAt,
            IsActive = true,
        };
        db.ApiKeys.Add(apiKey);
        await db.SaveChangesAsync();

        var dto = new ApiKeyDto(apiKey.Id, apiKey.Name, apiKey.LastUsedAt, apiKey.ExpiresAt, apiKey.IsActive, apiKey.CreatedAt);
        return new CreateApiKeyResponse(dto, plainKey);
    }

    public async Task<bool> RevokeKeyAsync(int id)
    {
        var apiKey = await db.ApiKeys.FirstOrDefaultAsync(k => k.Id == id);
        if (apiKey is null) return false;

        apiKey.IsActive = false;
        await db.SaveChangesAsync();
        return true;
    }
}
