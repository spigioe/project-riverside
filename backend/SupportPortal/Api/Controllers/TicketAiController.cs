using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Api.Extensions;
using SupportPortal.Application.DTOs.Ai;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/tickets/{id:int}/ai")]
public class TicketAiController(IAiService aiService) : ControllerBase
{
    [HttpPost("summarize")]
    [ProducesResponseType(typeof(AiSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Summarize(int id)
    {
        var result = await aiService.SummarizeAsync(id, User.GetUserId());
        return ToActionResult(result);
    }

    [HttpPost("suggest-reply")]
    [ProducesResponseType(typeof(AiSuggestReplyResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> SuggestReply(int id)
    {
        var result = await aiService.SuggestReplyAsync(id, User.GetUserId());
        return ToActionResult(result);
    }

    [HttpPost("classify")]
    [ProducesResponseType(typeof(AiClassifyResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Classify(int id)
    {
        var result = await aiService.ClassifyAsync(id, User.GetUserId());
        return ToActionResult(result);
    }

    private IActionResult ToActionResult<T>(AiOperationResult<T> result)
    {
        return result.Status switch
        {
            AiOperationStatus.Success => Ok(result.Data),
            AiOperationStatus.TicketNotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A jegy nem található."),
            AiOperationStatus.Unavailable =>
                Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: result.ErrorMessage ?? "Az AI szolgáltatás jelenleg nem érhető el."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }
}
