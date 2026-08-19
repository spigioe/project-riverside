using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Api.Extensions;
using SupportPortal.Application.DTOs.Common;
using SupportPortal.Application.DTOs.CustomFields;
using SupportPortal.Application.DTOs.Tickets;
using SupportPortal.Application.Interfaces;
using SupportPortal.Domain.Enums;
using SupportPortal.Infrastructure.Security;

namespace SupportPortal.Api.Controllers.V1;

// Developer API — külső integrációknak (pl. MCP szerver) szánt réteg, X-Api-Key authentikációval.
// A JWT-s Portal API-tól elkülönítve, saját OpenAPI dokumentummal (/swagger/developer/swagger.json).
[ApiController]
[Authorize(AuthenticationSchemes = ApiKeyAuthenticationHandler.SchemeName)]
[ApiExplorerSettings(GroupName = "developer")]
[Route("api/v1/tickets")]
public class TicketsV1Controller(
    ITicketService ticketService,
    IClickUpLinkService clickUpLinkService,
    ICustomFieldService customFieldService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<TicketListItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTickets([FromQuery] TicketListQuery query)
    {
        return Ok(await ticketService.GetTicketsAsync(query));
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(TicketDetailWithRelationsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTicket(int id)
    {
        var ticket = await ticketService.GetTicketByIdAsync(id);
        if (ticket is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        var messages = await ticketService.GetMessagesAsync(id) ?? [];
        var clickUpLinks = await clickUpLinkService.GetLinksAsync(id) ?? [];
        var customFieldValues = await customFieldService.GetValuesAsync(id) ?? [];
        var customFields = customFieldValues
            .Select(v => new CustomFieldSummaryDto(v.FieldKey, v.Name, v.FieldType, v.Value))
            .ToList();

        return Ok(new TicketDetailWithRelationsDto(ticket, messages, clickUpLinks, customFields));
    }

    [HttpPost]
    [ProducesResponseType(typeof(TicketDetailDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateTicket([FromBody] CreateTicketRequest request)
    {
        var ticket = await ticketService.CreateTicketAsync(request, User.GetUserId(), TicketSource.Api);
        return CreatedAtAction(nameof(GetTicket), new { id = ticket.Id }, ticket);
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

    [HttpPost("{id:int}/messages")]
    [ProducesResponseType(typeof(TicketMessageDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddMessage(int id, [FromBody] CreateTicketMessageRequest request)
    {
        var message = await ticketService.AddMessageAsync(id, request, User.GetUserId());
        if (message is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return CreatedAtAction(nameof(GetMessages), new { id }, message);
    }
}
