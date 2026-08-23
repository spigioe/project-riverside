using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Application.DTOs.Common;
using SupportPortal.Application.DTOs.Companies;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/companies")]
public class CompaniesController(ICompanyService companyService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<CompanyDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCompanies([FromQuery] CompanyListQuery query)
    {
        return Ok(await companyService.GetCompaniesAsync(query));
    }

    [HttpGet("all")]
    [ProducesResponseType(typeof(IReadOnlyList<CompanyDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllCompanies()
    {
        return Ok(await companyService.GetAllAsync());
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(CompanyDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCompany(int id)
    {
        var company = await companyService.GetByIdAsync(id);
        if (company is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A cég nem található.");

        return Ok(company);
    }

    [HttpPost]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(typeof(CompanyDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateCompany([FromBody] CreateCompanyRequest request)
    {
        var (result, company) = await companyService.CreateAsync(request);
        return result switch
        {
            CompanySaveResult.Success => CreatedAtAction(nameof(GetCompany), new { id = company!.Id }, company),
            CompanySaveResult.DomainTaken =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Ez a domain már foglalt egy másik cégnél."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateCompany(int id, [FromBody] UpdateCompanyRequest request)
    {
        var existing = await companyService.GetByIdAsync(id);
        if (existing is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A cég nem található.");

        var result = await companyService.UpdateAsync(id, request);
        return result switch
        {
            CompanySaveResult.Success => NoContent(),
            CompanySaveResult.DomainTaken =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Ez a domain már foglalt egy másik cégnél."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteCompany(int id)
    {
        var result = await companyService.DeleteAsync(id);
        return result switch
        {
            CompanyDeleteResult.Success => NoContent(),
            CompanyDeleteResult.NotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A cég nem található."),
            CompanyDeleteResult.HasContacts =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "A cég nem törölhető, mert kontaktok vannak hozzárendelve."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }
}
