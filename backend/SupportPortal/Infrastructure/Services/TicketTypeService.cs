using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.TicketTypes;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Infrastructure.Services;

public class TicketTypeService(AppDbContext db) : ITicketTypeService
{
    public async Task<IReadOnlyList<TicketTypeDto>> GetAllAsync()
    {
        var types = await db.TicketTypes
            .AsNoTracking()
            .OrderBy(t => t.DisplayOrder)
            .ThenBy(t => t.Name)
            .ToListAsync();

        return types.Select(Map).ToList();
    }

    public async Task<(CreateTicketTypeResult Result, TicketTypeDto? Dto)> CreateAsync(CreateTicketTypeRequest request)
    {
        var name = request.Name.Trim();
        if (await db.TicketTypes.AnyAsync(t => t.Name == name))
            return (CreateTicketTypeResult.NameTaken, null);

        var maxOrder = await db.TicketTypes.MaxAsync(t => (int?)t.DisplayOrder) ?? -1;

        var entity = new TicketType
        {
            Name = name,
            Description = request.Description?.Trim(),
            DisplayOrder = maxOrder + 1,
            IsActive = true,
            IsSystem = false,
        };

        db.TicketTypes.Add(entity);
        await db.SaveChangesAsync();

        return (CreateTicketTypeResult.Success, Map(entity));
    }

    public async Task<UpdateTicketTypeDefinitionResult> UpdateAsync(int id, UpdateTicketTypeDefinitionRequest request)
    {
        var entity = await db.TicketTypes.FirstOrDefaultAsync(t => t.Id == id);
        if (entity is null) return UpdateTicketTypeDefinitionResult.NotFound;
        if (entity.IsSystem) return UpdateTicketTypeDefinitionResult.SystemType;

        var name = request.Name.Trim();
        if (await db.TicketTypes.AnyAsync(t => t.Id != id && t.Name == name))
            return UpdateTicketTypeDefinitionResult.NameTaken;

        entity.Name = name;
        entity.Description = request.Description?.Trim();
        await db.SaveChangesAsync();

        return UpdateTicketTypeDefinitionResult.Success;
    }

    public async Task<DeleteTicketTypeResult> DeleteAsync(int id)
    {
        var entity = await db.TicketTypes.FirstOrDefaultAsync(t => t.Id == id);
        if (entity is null) return DeleteTicketTypeResult.NotFound;
        if (entity.IsSystem) return DeleteTicketTypeResult.SystemType;

        var inUse = await db.Tickets.AnyAsync(t => t.Type == entity.Name);
        if (inUse) return DeleteTicketTypeResult.InUse;

        db.TicketTypes.Remove(entity);
        await db.SaveChangesAsync();
        return DeleteTicketTypeResult.Success;
    }

    public async Task ReorderAsync(ReorderTicketTypesRequest request)
    {
        var ids = request.Items.Select(i => i.Id).ToList();
        var entities = await db.TicketTypes.Where(t => ids.Contains(t.Id)).ToListAsync();
        var orderMap = request.Items.ToDictionary(i => i.Id, i => i.DisplayOrder);
        foreach (var e in entities)
            e.DisplayOrder = orderMap[e.Id];
        await db.SaveChangesAsync();
    }

    private static TicketTypeDto Map(TicketType t) =>
        new(t.Id, t.Name, t.Description, t.DisplayOrder, t.IsActive, t.IsSystem);
}
