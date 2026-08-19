using System.Text;
using System.Text.Json.Serialization;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using NSwag;
using NSwag.Generation.Processors.Security;
using SupportPortal.Application.DTOs;
using SupportPortal.Application.DTOs.Auth;
using SupportPortal.Application.DTOs.Encryption;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Infrastructure.Security;
using SupportPortal.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Database ───────────────────────────────────────────────────────────────────
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? Environment.GetEnvironmentVariable("DB_CONNECTION")
    ?? throw new InvalidOperationException("Connection string 'Default' not found.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)), mySqlOptions =>
    mySqlOptions.EnableRetryOnFailure(
        maxRetryCount: 5,
        maxRetryDelay: TimeSpan.FromSeconds(10),
        errorNumbersToAdd: null)));

// ── JWT Auth ───────────────────────────────────────────────────────────────────
var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()
    ?? throw new InvalidOperationException("JWT settings not found.");

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));

// ── Email (Mailpit) ────────────────────────────────────────────────────────────
var mailSettings = builder.Configuration.GetSection("Mail").Get<MailSettings>()
    ?? throw new InvalidOperationException("Mail settings not found.");

builder.Services.Configure<MailSettings>(builder.Configuration.GetSection("Mail"));

// ── Titkosítás (ClickUp API kulcs stb.) ───────────────────────────────────────
builder.Services.Configure<EncryptionSettings>(builder.Configuration.GetSection("Encryption"));
builder.Services.AddSingleton<IEncryptionService, AesEncryptionService>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidAudience = jwtSettings.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSettings.Secret)),
            ClockSkew = TimeSpan.Zero
        };

        // Az EventSource API nem tud egyéni Authorization headert küldeni, ezért az SSE stream
        // endpoint kivételesen query stringből is elfogadja a tokent. Szigorúan csak erre az
        // egy útvonalra korlátozva — minden más endpoint továbbra is csak Authorization headert fogad el.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (context.Request.Path.StartsWithSegments("/api/portal/notifications/stream"))
                {
                    var token = context.Request.Query["token"];
                    if (!string.IsNullOrEmpty(token))
                        context.Token = token;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ── Services ───────────────────────────────────────────────────────────────────
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITicketService, TicketService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddHttpClient<IEmailService, EmailService>(client =>
    client.BaseAddress = new Uri(mailSettings.ApiBaseUrl));
builder.Services.AddScoped<ITicketEmailProcessor, TicketEmailProcessor>();
builder.Services.AddHostedService<EmailPollingService>();
builder.Services.AddSingleton<INotificationService, NotificationService>();
builder.Services.AddScoped<ISlaService, SlaService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<ICannedResponseService, CannedResponseService>();
builder.Services.AddScoped<IApiKeyService, ApiKeyService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddHttpClient<IIntegrationService, IntegrationService>(client =>
    client.BaseAddress = new Uri("https://api.clickup.com/api/v2/"));

// ── Validáció ──────────────────────────────────────────────────────────────────
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();

// A nem-nullable string property-kre az ASP.NET Core (a <Nullable>enable</Nullable> miatt)
// automatikusan egy saját, angol "The X field is required." hibát injektálna a FluentValidation
// magyar üzenete mellé, ha egy kötelező mező teljesen hiányzik a JSON body-ból. Ezt tiltjuk le,
// hogy kizárólag a FluentValidation validátorok magyar üzenetei érvényesüljenek.
builder.Services.Configure<MvcOptions>(options =>
    options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true);

// ── OpenAPI / NSwag ────────────────────────────────────────────────────────────
builder.Services.AddOpenApiDocument(config =>
{
    config.DocumentName = "v1";
    config.Title = "Support Portal API";
    config.Version = "v1";
    config.AddSecurity("JWT", [], new OpenApiSecurityScheme
    {
        Type = OpenApiSecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "JWT Bearer token. Példa: \"Bearer {token}\""
    });
    config.OperationProcessors.Add(new AspNetCoreOperationSecurityScopeProcessor("JWT"));
});

// ── CORS (dev) ─────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCors", policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:80")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

var app = builder.Build();

// ── Dev: automigráció + seed ───────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DbSeeder.SeedAsync(db);
}

app.UseCors("DevCors");
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseOpenApi(); // /swagger/v1/swagger.json
    app.UseSwaggerUi(); // /swagger
}

app.MapControllers();

app.Run();
