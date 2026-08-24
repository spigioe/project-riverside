using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Application.DTOs.TicketTypes;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/ticket-types")]
public class TicketTypesController(ITicketTypeService ticketTypeService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<TicketTypeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
        => Ok(await ticketTypeService.GetAllAsync());

    [HttpPost]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(typeof(TicketTypeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateTicketTypeRequest request)
    {
        var (result, dto) = await ticketTypeService.CreateAsync(request);
        return result switch
        {
            CreateTicketTypeResult.Success => Created($"/api/portal/ticket-types/{dto!.Id}", dto),
            CreateTicketTypeResult.NameTaken =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Ez a típusnév már foglalt."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateTicketTypeDefinitionRequest request)
    {
        var result = await ticketTypeService.UpdateAsync(id, request);
        return result switch
        {
            UpdateTicketTypeDefinitionResult.Success => NoContent(),
            UpdateTicketTypeDefinitionResult.NotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A típus nem található."),
            UpdateTicketTypeDefinitionResult.SystemType =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "Rendszer típus nem szerkeszthető."),
            UpdateTicketTypeDefinitionResult.NameTaken =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Ez a típusnév már foglalt."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await ticketTypeService.DeleteAsync(id);
        return result switch
        {
            DeleteTicketTypeResult.Success => NoContent(),
            DeleteTicketTypeResult.NotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A típus nem található."),
            DeleteTicketTypeResult.SystemType =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "Rendszer típus nem törölhető."),
            DeleteTicketTypeResult.InUse =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "Ez a típus aktív jegyekhez van rendelve, nem törölhető."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPut("reorder")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Reorder([FromBody] ReorderTicketTypesRequest request)
    {
        await ticketTypeService.ReorderAsync(request);
        return NoContent();
    }
}
