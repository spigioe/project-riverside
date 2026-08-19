using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Api.Extensions;
using SupportPortal.Application.DTOs.Dashboard;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/dashboard")]
public class DashboardController(IDashboardService dashboardService) : ControllerBase
{
    [HttpGet("widgets")]
    [ProducesResponseType(typeof(IReadOnlyList<DashboardWidgetDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWidgets()
    {
        return Ok(await dashboardService.GetWidgetsAsync(User.GetUserId()));
    }

    [HttpPut("widgets")]
    [ProducesResponseType(typeof(IReadOnlyList<DashboardWidgetDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SaveWidgets([FromBody] UpdateDashboardWidgetsRequest request)
    {
        return Ok(await dashboardService.SaveWidgetsAsync(User.GetUserId(), request.Widgets));
    }

    [HttpGet("stats")]
    [ProducesResponseType(typeof(DashboardStatsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStats()
    {
        return Ok(await dashboardService.GetStatsAsync());
    }
}
