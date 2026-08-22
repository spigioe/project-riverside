namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class TicketMessage
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public Ticket Ticket { get; set; } = null!;
    public int? SourceTicketId { get; set; }
    public Ticket? SourceTicket { get; set; }
    public int? SenderUserId { get; set; }
    public User? SenderUser { get; set; }
    public string? SenderEmail { get; set; }
    public string Body { get; set; } = null!;
    public string? Cc { get; set; }
    public string? Bcc { get; set; }
    public bool IsInternalNote { get; set; } = false;
    public MessageDirection Direction { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<FileStorage> Attachments { get; set; } = [];
}
