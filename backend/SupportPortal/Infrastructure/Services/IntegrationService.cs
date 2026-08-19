using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SupportPortal.Application.DTOs.Integration;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Infrastructure.Services;

public class IntegrationService(AppDbContext db, IEncryptionService encryptionService, HttpClient httpClient, ILogger<IntegrationService> logger) : IIntegrationService
{
    private const string IntegrationType = "ClickUp";

    private record ClickUpSecrets(string ApiKey, string WorkspaceId);

    public async Task<ClickUpConfigDto> GetClickUpConfigAsync()
    {
        var setting = await db.IntegrationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.IntegrationType == IntegrationType);

        if (setting is null)
            return new ClickUpConfigDto(false, null, null, null);

        var secrets = Decode(setting.Config);
        return new ClickUpConfigDto(true, MaskKey(secrets.ApiKey), secrets.WorkspaceId, setting.UpdatedAt);
    }

    public async Task<ClickUpConfigDto> UpdateClickUpConfigAsync(UpdateClickUpConfigRequest request, int currentUserId)
    {
        var setting = await db.IntegrationSettings.FirstOrDefaultAsync(s => s.IntegrationType == IntegrationType);
        var encryptedConfig = Encode(new ClickUpSecrets(request.ApiKey, request.WorkspaceId));

        if (setting is null)
        {
            setting = new IntegrationSetting
            {
                IntegrationType = IntegrationType,
                Config = encryptedConfig,
                UpdatedById = currentUserId,
            };
            db.IntegrationSettings.Add(setting);
        }
        else
        {
            setting.Config = encryptedConfig;
            setting.UpdatedById = currentUserId;
            setting.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();

        return new ClickUpConfigDto(true, MaskKey(request.ApiKey), request.WorkspaceId, setting.UpdatedAt);
    }

    public async Task<TestClickUpConnectionResponse> TestClickUpConnectionAsync()
    {
        var setting = await db.IntegrationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.IntegrationType == IntegrationType);

        if (setting is null)
            return new TestClickUpConnectionResponse(false, "A ClickUp integráció még nincs beállítva.");

        var secrets = Decode(setting.Config);

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "team");
            request.Headers.TryAddWithoutValidation("Authorization", secrets.ApiKey);

            var response = await httpClient.SendAsync(request);
            if (response.IsSuccessStatusCode)
                return new TestClickUpConnectionResponse(true, "A kapcsolat sikeresen létrejött.");

            return new TestClickUpConnectionResponse(false, $"A ClickUp API hibát adott vissza ({(int)response.StatusCode}).");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ClickUp kapcsolat teszt sikertelen.");
            return new TestClickUpConnectionResponse(false, "Nem sikerült kapcsolódni a ClickUp API-hoz.");
        }
    }

    public async Task<string?> GetDecryptedApiKeyAsync()
    {
        var setting = await db.IntegrationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.IntegrationType == IntegrationType);

        if (setting is null) return null;

        return Decode(setting.Config).ApiKey;
    }

    private string Encode(ClickUpSecrets secrets) =>
        encryptionService.Encrypt(JsonSerializer.Serialize(secrets));

    private ClickUpSecrets Decode(string encryptedConfig) =>
        JsonSerializer.Deserialize<ClickUpSecrets>(encryptionService.Decrypt(encryptedConfig))!;

    private static string MaskKey(string apiKey)
    {
        if (apiKey.Length <= 8) return new string('*', apiKey.Length);
        return $"{apiKey[..4]}{new string('*', apiKey.Length - 8)}{apiKey[^4..]}";
    }
}
