using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Application.DTOs.CustomStatuses;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/settings/custom-statuses")]
public class CustomStatusesController(ICustomStatusService customStatusService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CustomStatusDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
        => Ok(await customStatusService.GetAllAsync());

    [HttpPost]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(typeof(CustomStatusDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateCustomStatusRequest request)
    {
        var (result, dto) = await customStatusService.CreateAsync(request);
        return result switch
        {
            CustomStatusSaveResult.Success => Created($"/api/portal/settings/custom-statuses/{dto!.Id}", dto),
            CustomStatusSaveResult.KeyTaken =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Ez a kulcs már foglalt egy másik státusznál."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCustomStatusRequest request)
    {
        var result = await customStatusService.UpdateAsync(id, request);
        return result switch
        {
            CustomStatusSaveResult.Success => NoContent(),
            CustomStatusSaveResult.NotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A státusz nem található."),
            CustomStatusSaveResult.KeyTaken =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Ez a kulcs már foglalt egy másik státusznál."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await customStatusService.DeleteAsync(id);
        if (!deleted)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A státusz nem található.");
        return NoContent();
    }
}
