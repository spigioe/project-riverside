namespace SupportPortal.Domain.Entities;

public class SlaPolicyDomain
{
    public int Id { get; set; }
    public int SlaPolicyId { get; set; }
    public SlaPolicy SlaPolicy { get; set; } = null!;
    public string EmailDomain { get; set; } = null!;
}
