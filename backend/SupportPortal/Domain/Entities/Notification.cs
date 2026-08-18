namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class Notification
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int? TicketId { get; set; }
    public Ticket? Ticket { get; set; }
    public NotificationTrigger TriggerType { get; set; }
    public string Message { get; set; } = null!;
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
