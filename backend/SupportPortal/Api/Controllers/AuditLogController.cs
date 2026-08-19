using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Application.DTOs.AuditLog;
using SupportPortal.Application.DTOs.Common;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize(Roles = "MasterAdmin")]
[Route("api/portal/audit-log")]
public class AuditLogController(IAuditLogService auditLogService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<AuditLogDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAuditLog([FromQuery] AuditLogQuery query)
    {
        return Ok(await auditLogService.GetAsync(query));
    }
}
