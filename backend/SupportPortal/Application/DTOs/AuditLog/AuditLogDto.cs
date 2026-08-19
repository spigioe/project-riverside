namespace SupportPortal.Application.DTOs.AuditLog;

public record AuditLogDto(
    int Id, int? UserId, string? UserName, string EntityType, int EntityId,
    string Action, string? OldValue, string? NewValue, DateTime CreatedAt
);

public record AuditLogQuery(string? EntityType, int Page = 1, int PageSize = 20);
