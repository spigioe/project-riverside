using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Api.Extensions;
using SupportPortal.Application.DTOs.UserPreferences;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/me")]
public class MeController(IUserPreferenceService preferenceService) : ControllerBase
{
    [HttpGet("preferences")]
    [ProducesResponseType(typeof(UserPreferenceDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPreferences()
    {
        return Ok(await preferenceService.GetAsync(User.GetUserId()));
    }

    [HttpPut("preferences")]
    [ProducesResponseType(typeof(UserPreferenceDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdatePreferences([FromBody] UpdateUserPreferenceRequest request)
    {
        return Ok(await preferenceService.UpdateAsync(User.GetUserId(), request));
    }
}
