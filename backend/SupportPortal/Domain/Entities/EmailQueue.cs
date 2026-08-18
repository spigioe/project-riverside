namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class EmailQueue
{
    public int Id { get; set; }
    public int? TicketId { get; set; }
    public Ticket? Ticket { get; set; }
    public string FromAddress { get; set; } = null!;
    public string ToAddress { get; set; } = null!;
    public string Subject { get; set; } = null!;
    public string Body { get; set; } = null!;
    public EmailQueueStatus Status { get; set; } = EmailQueueStatus.Pending;
    public int Attempts { get; set; } = 0;
    public string? ExternalMessageId { get; set; }  // UNIQUE
    public string? InReplyTo { get; set; }
    public string? ReferencesHeader { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SentAt { get; set; }
}
