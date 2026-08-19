using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Application.DTOs.Analytics;
using SupportPortal.Application.Interfaces;
using SupportPortal.Infrastructure.Security;

namespace SupportPortal.Api.Controllers.V1;

[ApiController]
[Authorize(AuthenticationSchemes = ApiKeyAuthenticationHandler.SchemeName)]
[ApiExplorerSettings(GroupName = "developer")]
[Route("api/v1/analytics")]
public class AnalyticsController(IAnalyticsService analyticsService) : ControllerBase
{
    [HttpGet("tickets-by-category")]
    [ProducesResponseType(typeof(IReadOnlyList<TicketsByCategoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTicketsByCategory([FromQuery] AnalyticsPeriodQuery query)
    {
        return Ok(await analyticsService.GetTicketsByCategoryAsync(query));
    }

    [HttpGet("tickets-by-status")]
    [ProducesResponseType(typeof(IReadOnlyList<TicketsByStatusDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTicketsByStatus([FromQuery] AnalyticsPeriodQuery query)
    {
        return Ok(await analyticsService.GetTicketsByStatusAsync(query));
    }

    [HttpGet("sla-compliance")]
    [ProducesResponseType(typeof(SlaComplianceDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSlaCompliance([FromQuery] AnalyticsPeriodQuery query)
    {
        return Ok(await analyticsService.GetSlaComplianceAsync(query));
    }

    [HttpGet("recent-activity")]
    [ProducesResponseType(typeof(IReadOnlyList<RecentActivityItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRecentActivity([FromQuery] int limit = 20)
    {
        return Ok(await analyticsService.GetRecentActivityAsync(limit));
    }
}
