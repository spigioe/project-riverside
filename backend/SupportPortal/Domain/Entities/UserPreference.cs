namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class UserPreference
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public bool TicketPropertiesAutosave { get; set; } = true;
    public TicketListView TicketListView { get; set; } = TicketListView.Table;
    public TicketDetailView TicketDetailView { get; set; } = TicketDetailView.Classic;
    public bool TicketDetailSplitReversed { get; set; } = false;
    public string? EmailSignature { get; set; }
}
