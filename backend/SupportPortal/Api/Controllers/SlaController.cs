using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Application.DTOs.Sla;
using SupportPortal.Application.Interfaces;
using SupportPortal.Application.DTOs.Settings;

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
        return Ok(await slaService.GetAllAsync());
    }

    [HttpGet("policies/{id:int}")]
    [ProducesResponseType(typeof(SlaPolicyDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPolicy(int id)
    {
        var policy = await slaService.GetByIdAsync(id);
        if (policy is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Az SLA policy nem található.");
        return Ok(policy);
    }

    [HttpPost("policies")]
    [ProducesResponseType(typeof(SlaPolicyDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreatePolicy([FromBody] CreateSlaPolicyRequest request)
    {
        var (result, policy) = await slaService.CreateAsync(request);
        return result switch
        {
            CreateSlaPolicyResult.Success => CreatedAtAction(nameof(GetPolicy), new { id = policy!.Id }, policy),
            CreateSlaPolicyResult.DefaultAlreadyExists =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Már létezik alapértelmezett SLA policy."),
            CreateSlaPolicyResult.CompanyNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott cég nem található."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPut("policies/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePolicy(int id, [FromBody] UpdateSlaPolicyRequest request)
    {
        var result = await slaService.UpdateAsync(id, request);
        return result switch
        {
            UpdateSlaPolicyResult.Success => NoContent(),
            UpdateSlaPolicyResult.NotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "Az SLA policy nem található."),
            UpdateSlaPolicyResult.CompanyNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott cég nem található."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpDelete("policies/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeletePolicy(int id)
    {
        var result = await slaService.DeleteAsync(id);
        return result switch
        {
            DeleteSlaPolicyResult.Success => NoContent(),
            DeleteSlaPolicyResult.NotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "Az SLA policy nem található."),
            DeleteSlaPolicyResult.CannotDeleteDefault =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "Az alapértelmezett SLA policy nem törölhető."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
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

    [HttpGet("freeze-statuses")]
    [ProducesResponseType(typeof(IReadOnlyList<SlaFreezeStatusDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetFreezeStatuses()
    {
        return Ok(await slaService.GetFreezeStatusesAsync());
    }

    [HttpPut("freeze-statuses")]
    [ProducesResponseType(typeof(IReadOnlyList<SlaFreezeStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateFreezeStatuses([FromBody] UpdateSlaFreezeStatusesRequest request)
    {
        if (request.Statuses is null || request.Statuses.Count == 0)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "A státuszok listája nem lehet üres.");
        return Ok(await slaService.UpdateFreezeStatusesAsync(request));
    }
}
