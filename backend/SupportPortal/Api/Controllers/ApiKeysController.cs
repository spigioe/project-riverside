using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Api.Extensions;
using SupportPortal.Application.DTOs.ApiKeys;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize(Roles = "MasterAdmin,Admin")]
[Route("api/portal/api-keys")]
public class ApiKeysController(IApiKeyService apiKeyService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ApiKeyDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetKeys()
    {
        return Ok(await apiKeyService.GetKeysAsync());
    }

    [HttpPost]
    [ProducesResponseType(typeof(CreateApiKeyResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateKey([FromBody] CreateApiKeyRequest request)
    {
        var result = await apiKeyService.CreateKeyAsync(request, User.GetUserId());
        return CreatedAtAction(nameof(GetKeys), null, result);
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RevokeKey(int id)
    {
        var success = await apiKeyService.RevokeKeyAsync(id);
        if (!success)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Az API kulcs nem található.");

        return NoContent();
    }
}
