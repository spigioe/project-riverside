using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SupportPortal.Data;

namespace SupportPortal.Infrastructure.Security;

public class ApiKeyAuthenticationSchemeOptions : AuthenticationSchemeOptions;

// A Developer API (/api/v1/*) X-Api-Key header alapján authentikál — nem JWT-vel.
// A kulcsot (ugyanúgy, mint az ApiKeyService a létrehozáskor) SHA-256-tal hasheljük és
// a support_portal.ApiKeys.KeyHash oszloppal egyezünk össze (egyenlőségvizsgálat, nem BCrypt —
// BCrypt salted hash-nél nincs O(1) lookup egyenlőséggel, csak minden aktív kulcson végigiterálva
// Verify()-jal lehetne, ami feleslegesen drága; a SHA-256 determinisztikus, így indexelhető).
public class ApiKeyAuthenticationHandler(
    IOptionsMonitor<ApiKeyAuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    AppDbContext db) : AuthenticationHandler<ApiKeyAuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "ApiKey";
    private const string HeaderName = "X-Api-Key";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(HeaderName, out var headerValues))
            return AuthenticateResult.Fail("Hiányzó X-Api-Key header.");

        var providedKey = headerValues.ToString();
        if (string.IsNullOrWhiteSpace(providedKey))
            return AuthenticateResult.Fail("Hiányzó X-Api-Key header.");

        var keyHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(providedKey)));

        var apiKey = await db.ApiKeys
            .Include(k => k.User)
            .FirstOrDefaultAsync(k => k.KeyHash == keyHash);

        if (apiKey is null || !apiKey.IsActive)
            return AuthenticateResult.Fail("Érvénytelen vagy inaktív API kulcs.");

        if (apiKey.ExpiresAt.HasValue && apiKey.ExpiresAt.Value < DateTime.UtcNow)
            return AuthenticateResult.Fail("Az API kulcs lejárt.");

        if (!apiKey.User.IsActive)
            return AuthenticateResult.Fail("Az API kulcshoz tartozó felhasználó inaktív.");

        apiKey.LastUsedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, apiKey.UserId.ToString()),
            new Claim("api_key_id", apiKey.Id.ToString()),
            new Claim("api_key_name", apiKey.Name),
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return AuthenticateResult.Success(ticket);
    }

    protected override async Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        Response.ContentType = "application/problem+json";

        var problem = new ProblemDetails
        {
            Type = "https://tools.ietf.org/html/rfc9110#section-15.5.2",
            Title = "Érvénytelen vagy hiányzó API kulcs.",
            Status = StatusCodes.Status401Unauthorized,
            Detail = "Az X-Api-Key headerben érvényes, aktív Developer API kulcsot kell küldeni.",
        };

        await Response.WriteAsync(JsonSerializer.Serialize(problem));
    }
}
