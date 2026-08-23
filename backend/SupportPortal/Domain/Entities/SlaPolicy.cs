namespace SupportPortal.Domain.Entities;

public class SlaPolicy
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsDefault { get; set; } = false;
    public bool BusinessHoursOnly { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SlaPolicyPriority> Priorities { get; set; } = [];
    public ICollection<SlaPolicyCompany> Companies { get; set; } = [];
}
