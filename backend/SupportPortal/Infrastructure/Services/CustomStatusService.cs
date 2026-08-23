using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.CustomStatuses;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Infrastructure.Services;

public class CustomStatusService(AppDbContext db) : ICustomStatusService
{
    public async Task<IReadOnlyList<CustomStatusDto>> GetAllAsync()
    {
        var statuses = await db.TicketCustomStatuses
            .AsNoTracking()
            .OrderBy(s => s.DisplayOrder)
            .ThenBy(s => s.Name)
            .ToListAsync();

        return statuses.Select(Map).ToList();
    }

    public async Task<CustomStatusDto?> GetByIdAsync(int id)
    {
        var s = await db.TicketCustomStatuses.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        return s is null ? null : Map(s);
    }

    public async Task<(CustomStatusSaveResult Result, CustomStatusDto? Dto)> CreateAsync(CreateCustomStatusRequest request)
    {
        var normalizedKey = request.Key.Trim().ToLowerInvariant();

        if (await db.TicketCustomStatuses.AnyAsync(s => s.Key == normalizedKey))
            return (CustomStatusSaveResult.KeyTaken, null);

        var entity = new TicketCustomStatus
        {
            Key = normalizedKey,
            Name = request.Name.Trim(),
            ColorVariant = request.ColorVariant,
            IconKey = request.IconKey,
            DisplayOrder = request.DisplayOrder,
        };
        db.TicketCustomStatuses.Add(entity);
        await db.SaveChangesAsync();
        return (CustomStatusSaveResult.Success, Map(entity));
    }

    public async Task<CustomStatusSaveResult> UpdateAsync(int id, UpdateCustomStatusRequest request)
    {
        var entity = await db.TicketCustomStatuses.FirstOrDefaultAsync(s => s.Id == id);
        if (entity is null) return CustomStatusSaveResult.NotFound;

        var normalizedKey = request.Key.Trim().ToLowerInvariant();
        if (await db.TicketCustomStatuses.AnyAsync(s => s.Id != id && s.Key == normalizedKey))
            return CustomStatusSaveResult.KeyTaken;

        entity.Key = normalizedKey;
        entity.Name = request.Name.Trim();
        entity.ColorVariant = request.ColorVariant;
        entity.IconKey = request.IconKey;
        entity.DisplayOrder = request.DisplayOrder;
        entity.IsActive = request.IsActive;
        await db.SaveChangesAsync();
        return CustomStatusSaveResult.Success;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var entity = await db.TicketCustomStatuses.FirstOrDefaultAsync(s => s.Id == id);
        if (entity is null) return false;

        // Clear CustomStatusKey on tickets that use this status
        await db.Tickets
            .Where(t => t.CustomStatusKey == entity.Key)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.CustomStatusKey, (string?)null));

        db.TicketCustomStatuses.Remove(entity);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> KeyExistsAsync(string key) =>
        await db.TicketCustomStatuses.AnyAsync(s => s.Key == key && s.IsActive);

    private static CustomStatusDto Map(TicketCustomStatus s) =>
        new(s.Id, s.Key, s.Name, s.ColorVariant, s.IconKey, s.DisplayOrder, s.IsActive);
}
