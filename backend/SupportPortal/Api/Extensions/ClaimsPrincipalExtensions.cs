using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace SupportPortal.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static int GetUserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (value is null || !int.TryParse(value, out var id))
            throw new InvalidOperationException("A felhasználói azonosító nem található a tokenben.");

        return id;
    }
}
