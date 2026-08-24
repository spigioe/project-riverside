namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class DashboardWidget
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DashboardWidgetType WidgetType { get; set; }
    public int Col { get; set; }
    public int Row { get; set; }
    public int ColSpan { get; set; } = 1;
    public int RowSpan { get; set; } = 1;
    public string? Config { get; set; } // JSON
}
