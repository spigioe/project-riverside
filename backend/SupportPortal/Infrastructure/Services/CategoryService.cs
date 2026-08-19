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
            .OrderBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.ParentId })
            .ToListAsync();

        List<CategoryDto> BuildChildren(int? parentId) =>
            all.Where(c => c.ParentId == parentId)
                .Select(c => new CategoryDto(c.Id, c.Name, c.ParentId, BuildChildren(c.Id)))
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

        var category = new TicketCategory { Name = request.Name, ParentId = request.ParentId };
        db.TicketCategories.Add(category);
        await db.SaveChangesAsync();

        return (CreateCategoryResult.Success, new CategoryDto(category.Id, category.Name, category.ParentId, []));
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
}
