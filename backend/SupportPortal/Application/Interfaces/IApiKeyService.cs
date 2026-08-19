using SupportPortal.Application.DTOs.ApiKeys;

namespace SupportPortal.Application.Interfaces;

public interface IApiKeyService
{
    Task<IReadOnlyList<ApiKeyDto>> GetKeysAsync();
    Task<CreateApiKeyResponse> CreateKeyAsync(CreateApiKeyRequest request, int currentUserId);
    Task<bool> RevokeKeyAsync(int id);
}
