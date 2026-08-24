using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Api.Extensions;
using SupportPortal.Application.DTOs.Analytics;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/analytics")]
public class PortalAnalyticsController(IAnalyticsService analyticsService) : ControllerBase
{
    [HttpGet("response-times")]
    [ProducesResponseType(typeof(ResponseTimesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetResponseTimes([FromQuery] AnalyticsQuery query)
    {
        var userId = IsMinScope(query.Scope) ? User.GetUserId() : (int?)null;
        return Ok(await analyticsService.GetResponseTimesAsync(query, userId));
    }

    [HttpGet("ticket-volume")]
    [ProducesResponseType(typeof(IReadOnlyList<TicketVolumeItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetTicketVolume([FromQuery] AnalyticsQuery query, [FromQuery] string groupBy = "day")
    {
        if (!string.Equals(groupBy, "day", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(groupBy, "hour", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ProblemDetailsFactory.CreateProblemDetails(HttpContext, 400,
                "Érvénytelen groupBy érték. Lehetséges értékek: day, hour."));

        var userId = IsMinScope(query.Scope) ? User.GetUserId() : (int?)null;
        return Ok(await analyticsService.GetTicketVolumeAsync(query, groupBy.ToLower(), userId));
    }

    [HttpGet("sla-compliance")]
    [ProducesResponseType(typeof(SlaComplianceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetSlaCompliance([FromQuery] AnalyticsQuery query)
    {
        var userId = IsMinScope(query.Scope) ? User.GetUserId() : (int?)null;
        return Ok(await analyticsService.GetSlaComplianceScopedAsync(query, userId));
    }

    private static bool IsMinScope(string? scope) =>
        string.Equals(scope, "mine", StringComparison.OrdinalIgnoreCase);
}
