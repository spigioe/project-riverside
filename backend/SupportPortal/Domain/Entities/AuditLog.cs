namespace SupportPortal.Domain.Entities;

public class AuditLog
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public User? User { get; set; }
    public string EntityType { get; set; } = null!;
    public int EntityId { get; set; }
    public string Action { get; set; } = null!;
    public string? OldValue { get; set; }  // JSON
    public string? NewValue { get; set; }  // JSON
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
