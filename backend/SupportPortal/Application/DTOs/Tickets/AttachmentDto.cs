namespace SupportPortal.Application.DTOs.Tickets;

public record AttachmentDto(
    int Id,
    int MessageId,
    string OriginalFilename,
    string MimeType,
    long FileSize,
    DateTime UploadedAt,
    string DownloadUrl
);
