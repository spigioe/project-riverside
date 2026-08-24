using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Categories;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public class CategoryService(AppDbContext db) : ICategoryService
{
    public async Task<IReadOnlyList<CategoryDto>> GetTreeAsync()
    {
        var all = await db.TicketCategories
            .AsNoTracking()
            .OrderBy(c => c.DisplayOrder).ThenBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.ParentId, c.DisplayOrder })
            .ToListAsync();

        List<CategoryDto> BuildChildren(int? parentId) =>
            all.Where(c => c.ParentId == parentId)
                .Select(c => new CategoryDto(c.Id, c.Name, c.ParentId, c.DisplayOrder, BuildChildren(c.Id)))
                .ToList();

        return BuildChildren(null);
    }

    public async Task<(CreateCategoryResult Result, CategoryDto? Category)> CreateAsync(CreateCategoryRequest request)
    {
        if (request.ParentId.HasValue)
        {
            var parentExists = await db.TicketCategories.AnyAsync(c => c.Id == request.ParentId.Value);
            if (!parentExists) return (CreateCategoryResult.ParentNotFound, null);
        }

        var maxOrder = await db.TicketCategories
            .Where(c => c.ParentId == request.ParentId)
            .MaxAsync(c => (int?)c.DisplayOrder) ?? -1;

        var category = new TicketCategory { Name = request.Name, ParentId = request.ParentId, DisplayOrder = maxOrder + 1 };
        db.TicketCategories.Add(category);
        await db.SaveChangesAsync();

        return (CreateCategoryResult.Success, new CategoryDto(category.Id, category.Name, category.ParentId, category.DisplayOrder, []));
    }

    public async Task<UpdateCategoryResult> UpdateAsync(int id, UpdateCategoryRequest request)
    {
        var category = await db.TicketCategories.FirstOrDefaultAsync(c => c.Id == id);
        if (category is null) return UpdateCategoryResult.NotFound;

        if (request.ParentId == id) return UpdateCategoryResult.ParentIsSelf;

        if (request.ParentId.HasValue)
        {
            var parentExists = await db.TicketCategories.AnyAsync(c => c.Id == request.ParentId.Value);
            if (!parentExists) return UpdateCategoryResult.ParentNotFound;
        }

        category.Name = request.Name;
        category.ParentId = request.ParentId;
        await db.SaveChangesAsync();

        return UpdateCategoryResult.Success;
    }

    public async Task<DeleteCategoryResult> DeleteAsync(int id)
    {
        var category = await db.TicketCategories.FirstOrDefaultAsync(c => c.Id == id);
        if (category is null) return DeleteCategoryResult.NotFound;

        var hasChildren = await db.TicketCategories.AnyAsync(c => c.ParentId == id);
        if (hasChildren) return DeleteCategoryResult.HasChildren;

        var hasActiveTickets = await db.Tickets.AnyAsync(t =>
            t.CategoryId == id && t.Status != TicketStatus.Closed && t.Status != TicketStatus.Resolved);
        if (hasActiveTickets) return DeleteCategoryResult.HasActiveTickets;

        db.TicketCategories.Remove(category);
        await db.SaveChangesAsync();
        return DeleteCategoryResult.Success;
    }

    public async Task ReorderAsync(ReorderCategoriesRequest request)
    {
        var ids = request.Items.Select(i => i.Id).ToList();
        var categories = await db.TicketCategories.Where(c => ids.Contains(c.Id)).ToListAsync();
        var orderMap = request.Items.ToDictionary(i => i.Id, i => i.DisplayOrder);
        foreach (var c in categories)
            c.DisplayOrder = orderMap[c.Id];
        await db.SaveChangesAsync();
    }
}
