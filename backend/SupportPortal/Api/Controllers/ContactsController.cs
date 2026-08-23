using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Application.DTOs.Common;
using SupportPortal.Application.DTOs.Contacts;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/contacts")]
public class ContactsController(IContactService contactService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<ContactDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetContacts([FromQuery] ContactListQuery query)
    {
        return Ok(await contactService.GetContactsAsync(query));
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(ContactDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetContact(int id)
    {
        var contact = await contactService.GetByIdAsync(id);
        if (contact is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A kontakt nem található.");

        return Ok(contact);
    }

    [HttpPost]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(typeof(ContactDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateContact([FromBody] CreateContactRequest request)
    {
        var (result, contact) = await contactService.CreateAsync(request);
        return result switch
        {
            ContactSaveResult.Success => CreatedAtAction(nameof(GetContact), new { id = contact!.Id }, contact),
            ContactSaveResult.EmailTaken =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Ez az email cím már foglalt egy másik kontaktnál."),
            ContactSaveResult.CompanyNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott cég nem található."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateContact(int id, [FromBody] UpdateContactRequest request)
    {
        var contact = await contactService.GetByIdAsync(id);
        if (contact is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A kontakt nem található.");

        var result = await contactService.UpdateAsync(id, request);
        return result switch
        {
            ContactSaveResult.Success => NoContent(),
            ContactSaveResult.EmailTaken =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Ez az email cím már foglalt egy másik kontaktnál."),
            ContactSaveResult.CompanyNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott cég nem található."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteContact(int id)
    {
        var result = await contactService.DeleteAsync(id);
        return result switch
        {
            ContactDeleteResult.Success => NoContent(),
            ContactDeleteResult.Deactivated => NoContent(),
            ContactDeleteResult.NotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A kontakt nem található."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPost("build-from-tickets")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(typeof(BuildFromTicketsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> BuildFromTickets()
    {
        var result = await contactService.BuildContactsFromTicketsAsync();
        return Ok(result);
    }
}
