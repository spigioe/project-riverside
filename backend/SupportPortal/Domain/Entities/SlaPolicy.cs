namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class SlaPolicy
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsDefault { get; set; } = false;
    public bool BusinessHoursOnly { get; set; } = true;
    public TicketPriority Priority { get; set; }
    public int ResponseTimeMinutes { get; set; }
    public int ResolutionTimeMinutes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SlaPolicyDomain> Domains { get; set; } = [];
}
