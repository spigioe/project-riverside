using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Application.DTOs.Sla;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize(Roles = "MasterAdmin,Admin")]
[Route("api/portal/sla")]
public class SlaController(ISlaService slaService) : ControllerBase
{
    [HttpGet("policies")]
    [ProducesResponseType(typeof(IReadOnlyList<SlaPolicyDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPolicies()
    {
        return Ok(await slaService.GetPoliciesAsync());
    }

    [HttpPut("policies/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePolicy(int id, [FromBody] UpdateSlaPolicyRequest request)
    {
        var result = await slaService.UpdatePolicyAsync(id, request);
        if (result == UpdateSlaPolicyResult.NotFound)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Az SLA policy nem található.");

        return NoContent();
    }

    [HttpGet("domains")]
    [ProducesResponseType(typeof(IReadOnlyList<SlaDomainDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDomains()
    {
        return Ok(await slaService.GetDomainsAsync());
    }

    [HttpPost("domains")]
    [ProducesResponseType(typeof(SlaDomainDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateDomain([FromBody] CreateSlaDomainRequest request)
    {
        var (result, domain) = await slaService.CreateDomainAsync(request);
        return result switch
        {
            CreateSlaDomainResult.Success => CreatedAtAction(nameof(GetDomains), null, domain),
            CreateSlaDomainResult.PolicyNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott SLA policy nem található."),
            CreateSlaDomainResult.DomainTaken =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Ez a domain már hozzá van rendelve egy policyhoz."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpDelete("domains/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDomain(int id)
    {
        var success = await slaService.DeleteDomainAsync(id);
        if (!success)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A domain kivétel nem található.");

        return NoContent();
    }

    [HttpGet("business-hours")]
    [ProducesResponseType(typeof(IReadOnlyList<BusinessHoursDayDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBusinessHours()
    {
        return Ok(await slaService.GetBusinessHoursAsync());
    }

    [HttpPut("business-hours")]
    [ProducesResponseType(typeof(IReadOnlyList<BusinessHoursDayDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateBusinessHours([FromBody] UpdateBusinessHoursRequest request)
    {
        return Ok(await slaService.UpdateBusinessHoursAsync(request));
    }
}
