using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.CannedResponses;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Infrastructure.Services;

public class CannedResponseService(AppDbContext db) : ICannedResponseService
{
    public async Task<IReadOnlyList<CannedResponseFolderDto>> GetFoldersAsync()
    {
        return await db.CannedResponseFolders
            .AsNoTracking()
            .OrderBy(f => f.DisplayOrder).ThenBy(f => f.Name)
            .Select(f => new CannedResponseFolderDto(f.Id, f.Name, f.CategoryId, f.Category != null ? f.Category.Name : null, f.DisplayOrder))
            .ToListAsync();
    }

    public async Task<(CreateFolderResult Result, CannedResponseFolderDto? Folder)> CreateFolderAsync(CreateCannedResponseFolderRequest request)
    {
        if (request.CategoryId.HasValue)
        {
            var categoryExists = await db.TicketCategories.AnyAsync(c => c.Id == request.CategoryId.Value);
            if (!categoryExists) return (CreateFolderResult.CategoryNotFound, null);
        }

        var folder = new CannedResponseFolder { Name = request.Name, CategoryId = request.CategoryId, DisplayOrder = request.DisplayOrder };
        db.CannedResponseFolders.Add(folder);
        await db.SaveChangesAsync();

        return (CreateFolderResult.Success, new CannedResponseFolderDto(folder.Id, folder.Name, folder.CategoryId, null, folder.DisplayOrder));
    }

    public async Task<UpdateFolderResult> UpdateFolderAsync(int id, UpdateCannedResponseFolderRequest request)
    {
        var folder = await db.CannedResponseFolders.FirstOrDefaultAsync(f => f.Id == id);
        if (folder is null) return UpdateFolderResult.NotFound;

        if (request.CategoryId.HasValue)
        {
            var categoryExists = await db.TicketCategories.AnyAsync(c => c.Id == request.CategoryId.Value);
            if (!categoryExists) return UpdateFolderResult.CategoryNotFound;
        }

        folder.Name = request.Name;
        folder.CategoryId = request.CategoryId;
        folder.DisplayOrder = request.DisplayOrder;
        await db.SaveChangesAsync();

        return UpdateFolderResult.Success;
    }

    public async Task<DeleteFolderResult> DeleteFolderAsync(int id)
    {
        var folder = await db.CannedResponseFolders.FirstOrDefaultAsync(f => f.Id == id);
        if (folder is null) return DeleteFolderResult.NotFound;

        var hasResponses = await db.CannedResponses.AnyAsync(r => r.FolderId == id);
        if (hasResponses) return DeleteFolderResult.HasResponses;

        db.CannedResponseFolders.Remove(folder);
        await db.SaveChangesAsync();
        return DeleteFolderResult.Success;
    }

    public async Task<IReadOnlyList<CannedResponseDto>> GetResponsesAsync(int? folderId)
    {
        var query = db.CannedResponses.AsNoTracking().AsQueryable();
        if (folderId.HasValue)
            query = query.Where(r => r.FolderId == folderId.Value);

        return await query
            .OrderBy(r => r.Title)
            .Select(r => new CannedResponseDto(r.Id, r.FolderId, r.Title, r.Body, r.IsActive, r.CreatedById, r.CreatedBy.FullName, r.CreatedAt))
            .ToListAsync();
    }

    public async Task<(CreateResponseResult Result, CannedResponseDto? Response)> CreateResponseAsync(CreateCannedResponseRequest request, int currentUserId)
    {
        var folderExists = await db.CannedResponseFolders.AnyAsync(f => f.Id == request.FolderId);
        if (!folderExists) return (CreateResponseResult.FolderNotFound, null);

        var response = new CannedResponse
        {
            FolderId = request.FolderId,
            Title = request.Title,
            Body = request.Body,
            CreatedById = currentUserId,
        };
        db.CannedResponses.Add(response);
        await db.SaveChangesAsync();

        var created = await db.CannedResponses
            .AsNoTracking()
            .Where(r => r.Id == response.Id)
            .Select(r => new CannedResponseDto(r.Id, r.FolderId, r.Title, r.Body, r.IsActive, r.CreatedById, r.CreatedBy.FullName, r.CreatedAt))
            .FirstAsync();

        return (CreateResponseResult.Success, created);
    }

    public async Task<UpdateResponseResult> UpdateResponseAsync(int id, UpdateCannedResponseRequest request)
    {
        var response = await db.CannedResponses.FirstOrDefaultAsync(r => r.Id == id);
        if (response is null) return UpdateResponseResult.NotFound;

        response.Title = request.Title;
        response.Body = request.Body;
        response.IsActive = request.IsActive;
        await db.SaveChangesAsync();

        return UpdateResponseResult.Success;
    }

    public async Task<bool> DeleteResponseAsync(int id)
    {
        var response = await db.CannedResponses.FirstOrDefaultAsync(r => r.Id == id);
        if (response is null) return false;

        db.CannedResponses.Remove(response);
        await db.SaveChangesAsync();
        return true;
    }
}
