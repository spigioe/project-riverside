namespace SupportPortal.Domain.Entities;

public class CsmManager
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string Email { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<CsmDomain> Domains { get; set; } = [];
    public ICollection<Ticket> Tickets { get; set; } = [];
}
