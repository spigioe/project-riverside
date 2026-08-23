namespace SupportPortal.Domain.Entities;

public class SlaPolicyPriority
{
    public int Id { get; set; }
    public int SlaPolicyId { get; set; }
    public SlaPolicy SlaPolicy { get; set; } = null!;
    public string Priority { get; set; } = null!;
    public int ResponseTimeMinutes { get; set; }
    public int? ResolutionTimeMinutes { get; set; }
}
