namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class AiInteraction
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public Ticket Ticket { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string PromptSnapshot { get; set; } = null!;
    public string ResponseSnapshot { get; set; } = null!;
    public string ModelUsed { get; set; } = null!;
    public int TokensUsed { get; set; }
    public AiInteractionType InteractionType { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
