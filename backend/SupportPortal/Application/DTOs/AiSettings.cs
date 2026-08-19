namespace SupportPortal.Application.DTOs;

public class AiSettings
{
    /// <summary>
    /// Anthropic API kulcs. Ha üres/nincs beállítva, az AI funkciók graceful degradation-nel
    /// leállnak (nem dobnak kivételt) — lásd AiService.
    /// </summary>
    public string? ApiKey { get; set; }
}
