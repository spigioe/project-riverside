namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class ClickUpSyncLog
{
    public int Id { get; set; }
    public ClickUpSyncTrigger TriggeredBy { get; set; }
    public int? TicketId { get; set; }
    public Ticket? Ticket { get; set; }
    public int LinksChecked { get; set; }
    public int LinksUpdated { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime RanAt { get; set; } = DateTime.UtcNow;
}
