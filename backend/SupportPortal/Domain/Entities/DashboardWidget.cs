namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class DashboardWidget
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DashboardWidgetType WidgetType { get; set; }
    public int PositionX { get; set; }
    public int PositionY { get; set; }
    public int Width { get; set; } = 1;
    public int Height { get; set; } = 1;
    public string? Config { get; set; } // JSON
}
