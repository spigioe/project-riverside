using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Application.DTOs.Csm;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize(Roles = "MasterAdmin,Admin")]
[Route("api/portal/csm")]
public class CsmController(ICsmService csmService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CsmDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        return Ok(await csmService.GetAllAsync());
    }

    [HttpPost]
    [ProducesResponseType(typeof(CsmDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateCsmRequest request)
    {
        var (result, csm) = await csmService.CreateAsync(request);
        return result switch
        {
            CreateCsmResult.Success => CreatedAtAction(nameof(GetAll), null, csm),
            CreateCsmResult.EmailTaken =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Ez az email cím már foglalt egy másik CSM-hez."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCsmRequest request)
    {
        var result = await csmService.UpdateAsync(id, request);
        return result switch
        {
            UpdateCsmResult.Success => NoContent(),
            UpdateCsmResult.NotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A CSM nem található."),
            UpdateCsmResult.EmailTaken =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Ez az email cím már foglalt egy másik CSM-hez."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await csmService.DeleteAsync(id);
        return result switch
        {
            DeleteCsmResult.Success => NoContent(),
            DeleteCsmResult.NotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A CSM nem található."),
            DeleteCsmResult.HasActiveTickets =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "A CSM nem törölhető, mert aktív ticket van hozzárendelve."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpGet("suggest")]
    [ProducesResponseType(typeof(CsmSuggestionDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Suggest([FromQuery] string requesterEmail)
    {
        return Ok(await csmService.SuggestAsync(requesterEmail));
    }
}
