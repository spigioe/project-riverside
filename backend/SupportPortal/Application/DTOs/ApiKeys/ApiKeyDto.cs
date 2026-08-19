namespace SupportPortal.Application.DTOs.ApiKeys;

public record ApiKeyDto(int Id, string Name, DateTime? LastUsedAt, DateTime? ExpiresAt, bool IsActive, DateTime CreatedAt);

public record CreateApiKeyRequest(string Name, DateTime? ExpiresAt);

public record CreateApiKeyResponse(ApiKeyDto ApiKey, string PlainKey);
