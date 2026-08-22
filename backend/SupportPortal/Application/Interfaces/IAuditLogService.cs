using SupportPortal.Application.DTOs.AuditLog;
using SupportPortal.Application.DTOs.Common;

namespace SupportPortal.Application.Interfaces;

public interface IAuditLogService
{
    Task<PagedResult<AuditLogDto>> GetAsync(AuditLogQuery query);
    Task LogAsync(int? userId, string entityType, int entityId, string action, string? oldValue, string? newValue);
}
