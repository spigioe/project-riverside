using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportPortal.Application.DTOs.Users;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/portal/users")]
public class UsersController(IUserService userService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<UserSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUsers()
    {
        var users = await userService.GetActiveUsersAsync();
        return Ok(users);
    }

    [HttpGet("all")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(typeof(IReadOnlyList<UserAdminDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllUsers()
    {
        var users = await userService.GetAllUsersAsync();
        return Ok(users);
    }

    [HttpPost]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(typeof(UserAdminDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        var (result, user) = await userService.CreateUserAsync(request);
        return result switch
        {
            CreateUserResult.Success => CreatedAtAction(nameof(GetAllUsers), null, user),
            CreateUserResult.EmailTaken =>
                Problem(statusCode: StatusCodes.Status409Conflict, title: "Ez az email cím már foglalt."),
            CreateUserResult.RoleNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott szerepkör nem található."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
    {
        var result = await userService.UpdateUserAsync(id, request);
        return result switch
        {
            UpdateUserResult.Success => NoContent(),
            UpdateUserResult.UserNotFound =>
                Problem(statusCode: StatusCodes.Status404NotFound, title: "A felhasználó nem található."),
            UpdateUserResult.RoleNotFound =>
                Problem(statusCode: StatusCodes.Status400BadRequest, title: "A megadott szerepkör nem található."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError),
        };
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "MasterAdmin,Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeactivateUser(int id)
    {
        var success = await userService.DeactivateUserAsync(id);
        if (!success)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "A felhasználó nem található.");

        return NoContent();
    }
}
