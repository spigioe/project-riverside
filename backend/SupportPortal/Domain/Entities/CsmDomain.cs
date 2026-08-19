namespace SupportPortal.Domain.Entities;

public class CsmDomain
{
    public int Id { get; set; }
    public int CsmId { get; set; }
    public CsmManager Csm { get; set; } = null!;
    public string EmailDomain { get; set; } = null!;
}
