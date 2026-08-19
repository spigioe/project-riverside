namespace SupportPortal.Application.DTOs.Integration;

public record ClickUpConfigDto(bool IsConfigured, string? ApiKeyMasked, string? WorkspaceId, DateTime? UpdatedAt);

public record UpdateClickUpConfigRequest(string ApiKey, string WorkspaceId);

public record TestClickUpConnectionResponse(bool Success, string Message);
