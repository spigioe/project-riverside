namespace SupportPortal.Domain.Entities;

public class SlaFreezeStatus
{
    public int Id { get; set; }
    public string StatusKey { get; set; } = null!;
    public bool FreezeEnabled { get; set; }
}
