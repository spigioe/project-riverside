namespace SupportPortal.Domain.Entities;

public class CannedResponse
{
    public int Id { get; set; }
    public int FolderId { get; set; }
    public CannedResponseFolder Folder { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; } = 0;
    public int CreatedById { get; set; }
    public User CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
