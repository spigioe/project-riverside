namespace SupportPortal.Domain.Entities;

public class TicketCustomStatus
{
    public int Id { get; set; }
    public string Key { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string ColorVariant { get; set; } = "gray";
    public string IconKey { get; set; } = "circle-dot";
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
