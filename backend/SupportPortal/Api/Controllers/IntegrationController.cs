using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Api.Extensions;
using SupportPortal.Application.DTOs.Integration;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize(Roles = "MasterAdmin,Admin")]
[Route("api/portal/integration/clickup")]
public class IntegrationController(IIntegrationService integrationService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ClickUpConfigDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetConfig()
    {
        return Ok(await integrationService.GetClickUpConfigAsync());
    }

    [HttpPut]
    [ProducesResponseType(typeof(ClickUpConfigDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateConfig([FromBody] UpdateClickUpConfigRequest request)
    {
        return Ok(await integrationService.UpdateClickUpConfigAsync(request, User.GetUserId()));
    }

    [HttpPost("test-connection")]
    [ProducesResponseType(typeof(TestClickUpConnectionResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> TestConnection()
    {
        return Ok(await integrationService.TestClickUpConnectionAsync());
    }
}
