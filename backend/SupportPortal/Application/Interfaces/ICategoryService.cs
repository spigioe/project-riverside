using SupportPortal.Application.DTOs.Categories;

namespace SupportPortal.Application.Interfaces;

public enum CreateCategoryResult { Success, ParentNotFound }

public enum UpdateCategoryResult { Success, NotFound, ParentNotFound, ParentIsSelf }

public enum DeleteCategoryResult { Success, NotFound, HasActiveTickets, HasChildren }

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryDto>> GetTreeAsync();
    Task<(CreateCategoryResult Result, CategoryDto? Category)> CreateAsync(CreateCategoryRequest request);
    Task<UpdateCategoryResult> UpdateAsync(int id, UpdateCategoryRequest request);
    Task<DeleteCategoryResult> DeleteAsync(int id);
}
