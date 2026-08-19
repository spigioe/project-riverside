using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Application.DTOs.CustomFields;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/tickets/{id:int}/custom-fields")]
public class TicketCustomFieldsController(ICustomFieldService customFieldService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CustomFieldValueDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetValues(int id)
    {
        var values = await customFieldService.GetValuesAsync(id);
        if (values is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return Ok(values);
    }

    [HttpPut]
    [ProducesResponseType(typeof(IReadOnlyList<CustomFieldValueDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateValues(int id, [FromBody] List<UpdateCustomFieldValueItem> values)
    {
        var result = await customFieldService.UpdateValuesAsync(id, values);
        switch (result)
        {
            case CustomFieldValuesUpdateResult.TicketNotFound:
                return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");
            case CustomFieldValuesUpdateResult.DefinitionNotFound:
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Ismeretlen egyéni mező azonosító.");
            case CustomFieldValuesUpdateResult.InvalidOptionValue:
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Az érték nem szerepel a mező választható opciói között.");
        }

        return Ok(await customFieldService.GetValuesAsync(id));
    }
}
