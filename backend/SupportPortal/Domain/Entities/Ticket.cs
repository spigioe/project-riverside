namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class Ticket
{
    public int Id { get; set; }
    public string Subject { get; set; } = null!;
    public string Body { get; set; } = null!;
    public TicketStatus Status { get; set; } = TicketStatus.New;
    public TicketPriority Priority { get; set; } = TicketPriority.Medium;
    public int? CategoryId { get; set; }
    public TicketCategory? Category { get; set; }
    public int? AssignedToId { get; set; }
    public User? AssignedTo { get; set; }
    public int? CreatedById { get; set; }
    public User? CreatedBy { get; set; }
    public string RequesterEmail { get; set; } = null!;
    public string RequesterName { get; set; } = null!;
    public TicketSource Source { get; set; } = TicketSource.Portal;
    public TicketType? Type { get; set; }
    public bool IsCsmFlagged { get; set; } = false;
    public int? CsmId { get; set; }
    public CsmManager? Csm { get; set; }
    public int? MergedIntoTicketId { get; set; }
    public Ticket? MergedIntoTicket { get; set; }
    public bool IsMerged { get; set; } = false;
    public int? ContactId { get; set; }
    public Contact? Contact { get; set; }
    public DateTime? SlaDueAt { get; set; }
    public bool SlaBreach { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TicketMessage> Messages { get; set; } = [];
    public ICollection<Notification> Notifications { get; set; } = [];
    public ICollection<AiInteraction> AiInteractions { get; set; } = [];
    public ICollection<ClickUpLink> ClickUpLinks { get; set; } = [];
    public ICollection<CustomFieldValue> CustomFieldValues { get; set; } = [];
    public ICollection<EmailQueue> EmailQueues { get; set; } = [];
    public ICollection<ClickUpSyncLog> ClickUpSyncLogs { get; set; } = [];
}
