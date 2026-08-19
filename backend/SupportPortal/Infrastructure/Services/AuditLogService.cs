using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.AuditLog;
using SupportPortal.Application.DTOs.Common;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;

namespace SupportPortal.Infrastructure.Services;

public class AuditLogService(AppDbContext db) : IAuditLogService
{
    public async Task<PagedResult<AuditLogDto>> GetAsync(AuditLogQuery query)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 100 ? 20 : query.PageSize;

        var logsQuery = db.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.EntityType))
            logsQuery = logsQuery.Where(l => l.EntityType == query.EntityType);

        var totalCount = await logsQuery.CountAsync();

        var items = await logsQuery
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new AuditLogDto(
                l.Id, l.UserId, l.User != null ? l.User.FullName : null,
                l.EntityType, l.EntityId, l.Action, l.OldValue, l.NewValue, l.CreatedAt))
            .ToListAsync();

        return new PagedResult<AuditLogDto>(items, page, pageSize, totalCount);
    }
}
