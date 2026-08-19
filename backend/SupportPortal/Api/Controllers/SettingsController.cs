using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SupportPortal.Application.DTOs;
using SupportPortal.Application.DTOs.Settings;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize(Roles = "MasterAdmin,Admin")]
[Route("api/portal/settings")]
public class SettingsController(IOptions<MailSettings> mailOptions) : ControllerBase
{
    [HttpGet("email")]
    [ProducesResponseType(typeof(EmailSettingsDto), StatusCodes.Status200OK)]
    public IActionResult GetEmailSettings()
    {
        var mail = mailOptions.Value;
        return Ok(new EmailSettingsDto(mail.SmtpHost, mail.SmtpPort, mail.ApiBaseUrl, mail.PollIntervalSeconds, mail.FromAddress));
    }
}
