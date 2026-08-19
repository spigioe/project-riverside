namespace SupportPortal.Application.DTOs.Categories;

public record CategoryDto(int Id, string Name, int? ParentId, IReadOnlyList<CategoryDto> Children);

public record CreateCategoryRequest(string Name, int? ParentId);

public record UpdateCategoryRequest(string Name, int? ParentId);
