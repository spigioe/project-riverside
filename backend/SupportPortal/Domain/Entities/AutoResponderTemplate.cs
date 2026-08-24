namespace SupportPortal.Domain.Entities;

public class AutoResponderTemplate
{
    public int Id { get; set; }
    public string Trigger { get; set; } = "new_ticket";
    public string SubjectTemplate { get; set; } = null!;
    public string BodyTemplate { get; set; } = null!;
    public bool IsEnabled { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
