using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Api.Extensions;
using SupportPortal.Application.DTOs.CannedResponses;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
public class CannedResponsesController(ICannedResponseService cannedResponseService) : ControllerBase
{
    [HttpGet("api/portal/canned-response-folders")]
    [ProducesResponseType(typeof(IReadOnlyList<CannedResponseFolderDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetFolders()
    {
        return Ok(await cannedResponseService.GetFoldersAsync());
    }

    [HttpPost("api/portal/canned-response-folders")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(typeof(CannedResponseFolderDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateFolder([FromBody] CreateCannedResponseFolderRequest request)
    {
        var (result, folder) = await cannedResponseService.CreateFolderAsync(request);
        return result switch
        {
            CreateFolderResult.Success => CreatedAtAction(nameof(GetFolders), null, folder),
            CreateFolderResult.CategoryNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott kategória nem található."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPut("api/portal/canned-response-folders/{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateFolder(int id, [FromBody] UpdateCannedResponseFolderRequest request)
    {
        var result = await cannedResponseService.UpdateFolderAsync(id, request);
        return result switch
        {
            UpdateFolderResult.Success => NoContent(),
            UpdateFolderResult.NotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A mappa nem található."),
            UpdateFolderResult.CategoryNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott kategória nem található."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpDelete("api/portal/canned-response-folders/{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteFolder(int id)
    {
        var result = await cannedResponseService.DeleteFolderAsync(id);
        return result switch
        {
            DeleteFolderResult.Success => NoContent(),
            DeleteFolderResult.NotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A mappa nem található."),
            DeleteFolderResult.HasResponses =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "A mappában válaszsablonok vannak, nem törölhető."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpGet("api/portal/canned-responses")]
    [ProducesResponseType(typeof(IReadOnlyList<CannedResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetResponses([FromQuery] int? folderId)
    {
        return Ok(await cannedResponseService.GetResponsesAsync(folderId));
    }

    [HttpPost("api/portal/canned-responses")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(typeof(CannedResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateResponse([FromBody] CreateCannedResponseRequest request)
    {
        var (result, response) = await cannedResponseService.CreateResponseAsync(request, User.GetUserId());
        return result switch
        {
            CreateResponseResult.Success => CreatedAtAction(nameof(GetResponses), null, response),
            CreateResponseResult.FolderNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott mappa nem található."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPut("api/portal/canned-responses/{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateResponse(int id, [FromBody] UpdateCannedResponseRequest request)
    {
        var result = await cannedResponseService.UpdateResponseAsync(id, request);
        if (result == UpdateResponseResult.NotFound)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A válaszsablon nem található.");

        return NoContent();
    }

    [HttpDelete("api/portal/canned-responses/{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteResponse(int id)
    {
        var success = await cannedResponseService.DeleteResponseAsync(id);
        if (!success)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A válaszsablon nem található.");

        return NoContent();
    }
}
