using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Api.Extensions;
using SupportPortal.Application.DTOs.Tickets;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/tickets")]
public class TicketController(ITicketService ticketService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetTickets([FromQuery] TicketListQuery query)
    {
        var result = await ticketService.GetTicketsAsync(query);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetTicket(int id)
    {
        var ticket = await ticketService.GetTicketByIdAsync(id);
        if (ticket is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return Ok(ticket);
    }

    [HttpPost]
    public async Task<IActionResult> CreateTicket([FromBody] CreateTicketRequest request)
    {
        var ticket = await ticketService.CreateTicketAsync(request, User.GetUserId());
        return CreatedAtAction(nameof(GetTicket), new { id = ticket.Id }, ticket);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateTicket(int id, [FromBody] UpdateTicketRequest request)
    {
        var success = await ticketService.UpdateTicketAsync(id, request);
        if (!success)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return NoContent();
    }

    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateTicketStatusRequest request)
    {
        var success = await ticketService.UpdateStatusAsync(id, request.Status);
        if (!success)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return NoContent();
    }

    [HttpPatch("{id:int}/assign")]
    public async Task<IActionResult> AssignTicket(int id, [FromBody] AssignTicketRequest request)
    {
        var result = await ticketService.AssignAsync(id, request.AssignedToId);
        return result switch
        {
            TicketAssignResult.Success => NoContent(),
            TicketAssignResult.TicketNotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található."),
            TicketAssignResult.UserNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott felhasználó nem található vagy inaktív."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPatch("{id:int}/csm")]
    public async Task<IActionResult> ToggleCsm(int id)
    {
        var isCsmFlagged = await ticketService.ToggleCsmAsync(id);
        if (isCsmFlagged is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return Ok(new { isCsmFlagged = isCsmFlagged.Value });
    }

    [HttpPost("{id:int}/merge")]
    public async Task<IActionResult> MergeTicket(int id, [FromBody] MergeTicketRequest request)
    {
        var result = await ticketService.MergeAsync(id, request.TargetTicketId);
        return result switch
        {
            TicketMergeResult.Success => NoContent(),
            TicketMergeResult.TicketNotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található."),
            TicketMergeResult.TargetNotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A cél jegy nem található."),
            TicketMergeResult.SelfMerge =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "A jegy nem egyesíthető önmagával."),
            TicketMergeResult.SourceAlreadyMerged =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "A jegy már egyesítve lett egy másik jeggyel."),
            TicketMergeResult.TargetAlreadyMerged =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "A cél jegy már egyesítve lett egy másik jeggyel."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }
}
