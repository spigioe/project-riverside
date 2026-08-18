namespace SupportPortal.Domain.Entities;

public class ClickUpLink
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public Ticket Ticket { get; set; } = null!;
    public string ClickUpTaskId { get; set; } = null!;
    public string ClickUpTaskUrl { get; set; } = null!;
    public string? ClickUpTaskTitle { get; set; }
    public string? ClickUpStatus { get; set; }
    public DateTime? StatusSyncedAt { get; set; }
    public string? Notes { get; set; }
    public int CreatedById { get; set; }
    public User CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
