namespace SupportPortal.Domain.Entities;

public class SlaPolicyCompany
{
    public int Id { get; set; }
    public int SlaPolicyId { get; set; }
    public SlaPolicy SlaPolicy { get; set; } = null!;
    public int CompanyId { get; set; }
    public Company Company { get; set; } = null!;
}
