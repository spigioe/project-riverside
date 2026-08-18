namespace SupportPortal.Domain.Entities;

public class CannedResponseFolder
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public int? CategoryId { get; set; }
    public TicketCategory? Category { get; set; }
    public int DisplayOrder { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<CannedResponse> Responses { get; set; } = [];
}
