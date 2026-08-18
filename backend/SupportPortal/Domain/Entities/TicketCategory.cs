namespace SupportPortal.Domain.Entities;

public class TicketCategory
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public int? ParentId { get; set; }
    public TicketCategory? Parent { get; set; }
    public ICollection<TicketCategory> Children { get; set; } = [];
    public ICollection<Ticket> Tickets { get; set; } = [];
    public ICollection<CannedResponseFolder> CannedResponseFolders { get; set; } = [];
}
