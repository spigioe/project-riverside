namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class NotificationPreference
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public NotificationTrigger TriggerType { get; set; }
    public bool IsEnabled { get; set; } = true;
}
