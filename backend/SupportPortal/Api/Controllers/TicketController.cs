using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Api.Extensions;
using SupportPortal.Application.DTOs.Common;
using SupportPortal.Application.DTOs.Contacts;
using SupportPortal.Application.DTOs.CustomStatuses;
using SupportPortal.Application.DTOs.Tickets;
using SupportPortal.Application.Interfaces;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/tickets")]
public class TicketController(
    ITicketService ticketService,
    IClickUpLinkService clickUpLinkService,
    IServiceScopeFactory scopeFactory,
    ILogger<TicketController> logger) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<TicketListItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTickets([FromQuery] TicketListQuery query)
    {
        var result = await ticketService.GetTicketsAsync(query);
        return Ok(result);
    }

    [HttpGet("search")]
    [ProducesResponseType(typeof(IReadOnlyList<TicketSearchResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SearchTickets([FromQuery] string? q, [FromQuery] int limit = 10)
    {
        var results = await ticketService.SearchAsync(q, limit);
        return Ok(results);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(TicketDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTicket(int id)
    {
        var ticket = await ticketService.GetTicketByIdAsync(id);
        if (ticket is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        // Fire-and-forget: a ClickUp szinkron nem blokkolhatja a jegy betöltését. Saját scope-ban fut,
        // hogy a kérés lezárása után se szűnjön meg a mögötte lévő DbContext idő előtt.
        _ = TriggerOnDemandClickUpSyncAsync(id);

        return Ok(ticket);
    }

    [HttpPost]
    [ProducesResponseType(typeof(TicketDetailDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateTicket([FromBody] CreateTicketRequest request)
    {
        var ticket = await ticketService.CreateTicketAsync(request, User.GetUserId());
        return CreatedAtAction(nameof(GetTicket), new { id = ticket.Id }, ticket);
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateTicket(int id, [FromBody] UpdateTicketRequest request)
    {
        var success = await ticketService.UpdateTicketAsync(id, request, User.GetUserId());
        if (!success)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return NoContent();
    }

    [HttpPatch("{id:int}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateTicketStatusRequest request)
    {
        var success = await ticketService.UpdateStatusAsync(id, request.Status, User.GetUserId());
        if (!success)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return NoContent();
    }

    [HttpPatch("{id:int}/priority")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePriority(int id, [FromBody] UpdateTicketPriorityRequest request)
    {
        var success = await ticketService.UpdatePriorityAsync(id, request.Priority, User.GetUserId());
        if (!success)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return NoContent();
    }

    [HttpPatch("{id:int}/type")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateType(int id, [FromBody] UpdateTicketTypeRequest request)
    {
        var success = await ticketService.UpdateTypeAsync(id, request.Type, User.GetUserId());
        if (!success)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return NoContent();
    }

    [HttpPatch("{id:int}/assign")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AssignTicket(int id, [FromBody] AssignTicketRequest request)
    {
        var result = await ticketService.AssignAsync(id, request.AssignedToId, User.GetUserId());
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
    [ProducesResponseType(typeof(ToggleCsmResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleCsm(int id)
    {
        var isCsmFlagged = await ticketService.ToggleCsmAsync(id, User.GetUserId());
        if (isCsmFlagged is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return Ok(new ToggleCsmResponse(isCsmFlagged.Value));
    }

    [HttpPatch("{id:int}/csm-assign")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AssignCsm(int id, [FromBody] CsmAssignRequest request)
    {
        var result = await ticketService.AssignCsmAsync(id, request.CsmId, User.GetUserId());
        return result switch
        {
            TicketCsmAssignResult.Success => NoContent(),
            TicketCsmAssignResult.TicketNotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található."),
            TicketCsmAssignResult.CsmNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott CSM nem található."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPost("{id:int}/merge")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> MergeTicket(int id, [FromBody] MergeTicketRequest request)
    {
        var result = await ticketService.MergeAsync(id, request.TargetTicketId, User.GetUserId());
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

    [HttpGet("{id:int}/messages")]
    [ProducesResponseType(typeof(IReadOnlyList<TicketMessageDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMessages(int id)
    {
        var messages = await ticketService.GetMessagesAsync(id);
        if (messages is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return Ok(messages);
    }

    // multipart/form-data (nem JSON) — a csatolmányok (IFormFile lista) miatt. Lásd
    // CreateTicketMessageFormRequest a Portal API-specifikus alakért; a Developer API (V1) POST
    // /api/v1/tickets/{id}/messages változatlanul JSON-t fogad (CreateTicketMessageRequest), ott
    // nincs fájlfeltöltés-igény.
    [HttpPost("{id:int}/messages")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(TicketMessageDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddMessage(int id, [FromForm] CreateTicketMessageFormRequest request)
    {
        var message = await ticketService.AddMessageAsync(
            id,
            new CreateTicketMessageRequest(request.Body, request.IsInternalNote, request.Cc, request.Bcc),
            User.GetUserId(),
            request.Attachments);
        if (message is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return CreatedAtAction(nameof(GetMessages), new { id }, message);
    }

    [HttpGet("{id:int}/activity")]
    [ProducesResponseType(typeof(IReadOnlyList<TicketActivityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetActivity(int id)
    {
        var activity = await ticketService.GetActivityAsync(id);
        if (activity is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return Ok(activity);
    }

    [HttpGet("{id:int}/related")]
    [ProducesResponseType(typeof(IReadOnlyList<TicketRelatedDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRelated(int id)
    {
        var related = await ticketService.GetRelatedAsync(id);
        if (related is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return Ok(related);
    }

    [HttpGet("{id:int}/clickup")]
    [ProducesResponseType(typeof(IReadOnlyList<ClickUpLinkDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetClickUpLinks(int id)
    {
        var links = await clickUpLinkService.GetLinksAsync(id);
        if (links is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return Ok(links);
    }

    [HttpPost("{id:int}/clickup")]
    [ProducesResponseType(typeof(ClickUpLinkDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddClickUpLink(int id, [FromBody] CreateClickUpLinkRequest request)
    {
        var link = await clickUpLinkService.AddLinkAsync(id, request, User.GetUserId());
        if (link is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return CreatedAtAction(nameof(GetClickUpLinks), new { id }, link);
    }

    [HttpDelete("{id:int}/clickup/{linkId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteClickUpLink(int id, int linkId)
    {
        var success = await clickUpLinkService.DeleteLinkAsync(id, linkId, User.GetUserId());
        if (!success)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A ClickUp link nem található.");

        return NoContent();
    }

    [HttpPost("{id:int}/clickup/{linkId:int}/sync")]
    [ProducesResponseType(typeof(ClickUpLinkDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SyncClickUpLink(int id, int linkId)
    {
        var link = await clickUpLinkService.SyncLinkAsync(id, linkId, ClickUpSyncTrigger.UserOpen);
        if (link is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A ClickUp link nem található.");

        return Ok(link);
    }

    [HttpPatch("{id:int}/contact")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AssignContact(int id, [FromBody] AssignTicketContactRequest request)
    {
        var result = await ticketService.AssignContactAsync(id, request.ContactId, User.GetUserId());
        if (result is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");
        if (result is false)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott kontakt nem található.");

        return NoContent();
    }

    [HttpPatch("{id:int}/custom-status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AssignCustomStatus(int id, [FromBody] AssignCustomStatusRequest request)
    {
        var result = await ticketService.AssignCustomStatusAsync(id, request.Key, User.GetUserId());
        if (result is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");
        return NoContent();
    }

    private Task TriggerOnDemandClickUpSyncAsync(int ticketId)
    {
        return Task.Run(async () =>
        {
            using var scope = scopeFactory.CreateScope();
            try
            {
                var scopedClickUpLinkService = scope.ServiceProvider.GetRequiredService<IClickUpLinkService>();
                await scopedClickUpLinkService.SyncTicketLinksAsync(ticketId, ClickUpSyncTrigger.UserOpen);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "ClickUp on-demand szinkron sikertelen a(z) #{TicketId} jegynél.", ticketId);
            }
        });
    }
}
