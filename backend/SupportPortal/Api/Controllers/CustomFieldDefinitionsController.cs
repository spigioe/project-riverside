using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Api.Extensions;
using SupportPortal.Application.DTOs.CustomFields;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/custom-fields/definitions")]
public class CustomFieldDefinitionsController(ICustomFieldService customFieldService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CustomFieldDefinitionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDefinitions()
    {
        return Ok(await customFieldService.GetDefinitionsAsync());
    }

    [HttpPost]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(typeof(CustomFieldDefinitionDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateDefinition([FromBody] CreateCustomFieldDefinitionRequest request)
    {
        var (result, field) = await customFieldService.CreateDefinitionAsync(request, User.GetUserId());
        return result switch
        {
            CreateCustomFieldDefinitionResult.Success => CreatedAtAction(nameof(GetDefinitions), null, field),
            CreateCustomFieldDefinitionResult.FieldKeyTaken =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Ez a mezőkulcs már foglalt."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateDefinition(int id, [FromBody] UpdateCustomFieldDefinitionRequest request)
    {
        var result = await customFieldService.UpdateDefinitionAsync(id, request);
        if (result == UpdateCustomFieldDefinitionResult.NotFound)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Az egyéni mező nem található.");

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeactivateDefinition(int id)
    {
        var success = await customFieldService.DeactivateDefinitionAsync(id);
        if (!success)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Az egyéni mező nem található.");

        return NoContent();
    }
}
