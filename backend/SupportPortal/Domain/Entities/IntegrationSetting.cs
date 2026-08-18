namespace SupportPortal.Domain.Entities;

public class IntegrationSetting
{
    public int Id { get; set; }
    public string IntegrationType { get; set; } = null!;
    public string Config { get; set; } = null!;  // AES-256 titkosított JSON
    public bool IsActive { get; set; } = true;
    public int UpdatedById { get; set; }
    public User UpdatedBy { get; set; } = null!;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
