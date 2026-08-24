using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Application.DTOs.Tickets;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal")]
public class TicketAttachmentsController(IAttachmentService attachmentService) : ControllerBase
{
    [HttpGet("tickets/{ticketId:int}/attachments")]
    [ProducesResponseType(typeof(IReadOnlyList<AttachmentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAttachments(int ticketId)
    {
        var attachments = await attachmentService.GetForTicketAsync(ticketId);
        if (attachments is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return Ok(attachments);
    }

    [HttpGet("attachments/{id:int}/download")]
    [ProducesResponseType(typeof(FileStreamResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Download(int id)
    {
        var result = await attachmentService.GetDownloadAsync(id);
        if (result is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A csatolmány nem található.");

        var (stream, contentType, fileName) = result.Value;
        return File(stream, contentType, fileName);
    }

    [HttpPost("tickets/{ticketId:int}/attachments/inline")]
    [ProducesResponseType(typeof(InlineAttachmentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UploadInline(int ticketId, IFormFile file)
    {
        if (file is null || file.Length == 0)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Nincs feltöltött fájl.");

        if (!file.ContentType.StartsWith("image/"))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Csak képfájl tölthető fel inline módban.");

        var result = await attachmentService.UploadInlineAsync(ticketId, file);
        if (result is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található.");

        return Ok(result);
    }
}
