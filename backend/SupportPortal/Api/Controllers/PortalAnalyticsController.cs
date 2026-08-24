using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Api.Extensions;
using SupportPortal.Application.DTOs.Analytics;
using SupportPortal.Application.Interfaces;
#pragma warning disable CA1862 // string.Equals kovencionalitás

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

    [HttpGet("sla-breakdown")]
    [ProducesResponseType(typeof(SlaComplianceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetSlaBreakdown([FromQuery] AnalyticsQuery query)
    {
        var userId = IsMinScope(query.Scope) ? User.GetUserId() : (int?)null;
        return Ok(await analyticsService.GetSlaBreakdownAsync(query, userId));
    }

    [HttpGet("recent-tickets")]
    [ProducesResponseType(typeof(IReadOnlyList<RecentTicketItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetRecentTickets([FromQuery] AnalyticsQuery query, [FromQuery] int limit = 10)
    {
        if (limit is < 1 or > 50)
            return BadRequest(ProblemDetailsFactory.CreateProblemDetails(HttpContext, 400,
                "A limit értéke 1 és 50 között kell legyen."));
        return Ok(await analyticsService.GetRecentTicketsAsync(query, limit));
    }

    [HttpGet("my-open-tickets")]
    [ProducesResponseType(typeof(IReadOnlyList<MyOpenTicketItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetMyOpenTickets([FromQuery] int limit = 10)
    {
        if (limit is < 1 or > 50)
            return BadRequest(ProblemDetailsFactory.CreateProblemDetails(HttpContext, 400,
                "A limit értéke 1 és 50 között kell legyen."));
        return Ok(await analyticsService.GetMyOpenTicketsAsync(User.GetUserId(), limit));
    }

    [HttpGet("tickets-by-category")]
    [ProducesResponseType(typeof(IReadOnlyList<CategoryBreakdownItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetTicketsByCategory([FromQuery] AnalyticsQuery query, [FromQuery] int limit = 10)
    {
        if (limit is < 1 or > 50)
            return BadRequest(ProblemDetailsFactory.CreateProblemDetails(HttpContext, 400,
                "A limit értéke 1 és 50 között kell legyen."));
        var userId = IsMinScope(query.Scope) ? User.GetUserId() : (int?)null;
        return Ok(await analyticsService.GetCategoryBreakdownAsync(query, userId, limit));
    }

    [HttpGet("agent-performance")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(typeof(IReadOnlyList<AgentPerformanceItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetAgentPerformance([FromQuery] AnalyticsQuery query)
        => Ok(await analyticsService.GetAgentPerformanceAsync(query));

    [HttpGet("customer-activity")]
    [ProducesResponseType(typeof(IReadOnlyList<CustomerActivityItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetCustomerActivity([FromQuery] AnalyticsQuery query, [FromQuery] int limit = 10)
    {
        if (limit is < 1 or > 50)
            return BadRequest(ProblemDetailsFactory.CreateProblemDetails(HttpContext, 400,
                "A limit értéke 1 és 50 között kell legyen."));
        return Ok(await analyticsService.GetCustomerActivityAsync(query, limit));
    }

    private static bool IsMinScope(string? scope) =>
        string.Equals(scope, "mine", StringComparison.OrdinalIgnoreCase);
}
