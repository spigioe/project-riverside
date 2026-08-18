namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class FileStorage
{
    public int Id { get; set; }
    public int MessageId { get; set; }
    public TicketMessage Message { get; set; } = null!;
    public StorageBackend StorageBackend { get; set; } = StorageBackend.Minio;
    public string BucketOrPath { get; set; } = null!;
    public string ObjectKey { get; set; } = null!;
    public string OriginalFilename { get; set; } = null!;
    public string MimeType { get; set; } = null!;
    public long FileSize { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
