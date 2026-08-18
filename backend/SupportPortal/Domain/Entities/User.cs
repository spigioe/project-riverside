namespace SupportPortal.Domain.Entities;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }

    public ICollection<Ticket> AssignedTickets { get; set; } = [];
    public ICollection<Ticket> CreatedTickets { get; set; } = [];
    public ICollection<TicketMessage> Messages { get; set; } = [];
    public ICollection<Notification> Notifications { get; set; } = [];
    public ICollection<NotificationPreference> NotificationPreferences { get; set; } = [];
    public ICollection<AiInteraction> AiInteractions { get; set; } = [];
    public ICollection<ApiKey> ApiKeys { get; set; } = [];
    public ICollection<AuditLog> AuditLogs { get; set; } = [];
}
