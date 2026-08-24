using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Application.DTOs.Categories;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/categories")]
public class CategoriesController(ICategoryService categoryService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CategoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTree()
    {
        return Ok(await categoryService.GetTreeAsync());
    }

    [HttpPost]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateCategoryRequest request)
    {
        var (result, category) = await categoryService.CreateAsync(request);
        return result switch
        {
            CreateCategoryResult.Success => CreatedAtAction(nameof(GetTree), null, category),
            CreateCategoryResult.ParentNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott szülő kategória nem található."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCategoryRequest request)
    {
        var result = await categoryService.UpdateAsync(id, request);
        return result switch
        {
            UpdateCategoryResult.Success => NoContent(),
            UpdateCategoryResult.NotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A kategória nem található."),
            UpdateCategoryResult.ParentNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott szülő kategória nem található."),
            UpdateCategoryResult.ParentIsSelf =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A kategória nem lehet önmaga szülője."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await categoryService.DeleteAsync(id);
        return result switch
        {
            DeleteCategoryResult.Success => NoContent(),
            DeleteCategoryResult.NotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A kategória nem található."),
            DeleteCategoryResult.HasActiveTickets =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "A kategóriában aktív jegyek vannak, nem törölhető."),
            DeleteCategoryResult.HasChildren =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "A kategóriának alkategóriái vannak, nem törölhető."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPut("reorder")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Reorder([FromBody] ReorderCategoriesRequest request)
    {
        await categoryService.ReorderAsync(request);
        return NoContent();
    }
}
