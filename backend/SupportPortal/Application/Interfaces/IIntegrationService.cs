using SupportPortal.Application.DTOs.Integration;

namespace SupportPortal.Application.Interfaces;

public interface IIntegrationService
{
    Task<ClickUpConfigDto> GetClickUpConfigAsync();
    Task<ClickUpConfigDto> UpdateClickUpConfigAsync(UpdateClickUpConfigRequest request, int currentUserId);
    Task<TestClickUpConnectionResponse> TestClickUpConnectionAsync();

    // Csak belső használatra (pl. ClickUpLinkService) — a tényleges, nem maszkolt API kulcsot adja
    // vissza, vagy null-t, ha az integráció nincs beállítva.
    Task<string?> GetDecryptedApiKeyAsync();
}
