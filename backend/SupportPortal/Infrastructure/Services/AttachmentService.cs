using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SupportPortal.Application.DTOs;
using SupportPortal.Application.DTOs.Tickets;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public class AttachmentService(
    AppDbContext db,
    IFileStorageService fileStorageService,
    IOptions<MinioSettings> minioOptions) : IAttachmentService
{
    public async Task<IReadOnlyList<AttachmentDto>?> GetForTicketAsync(int ticketId)
    {
        var ticketExists = await db.Tickets.AnyAsync(t => t.Id == ticketId);
        if (!ticketExists) return null;

        return await db.FileStorages
            .AsNoTracking()
            .Where(f => !f.IsInline && (
                (f.MessageId != null && f.Message!.TicketId == ticketId) ||
                f.TicketId == ticketId))
            .OrderBy(f => f.UploadedAt)
            .Select(f => new AttachmentDto(
                f.Id, f.MessageId, f.OriginalFilename, f.MimeType, f.FileSize, f.UploadedAt,
                $"/api/portal/attachments/{f.Id}/download"))
            .ToListAsync();
    }

    public async Task<(Stream Stream, string ContentType, string FileName)?> GetDownloadAsync(int id)
    {
        var file = await db.FileStorages.AsNoTracking().FirstOrDefaultAsync(f => f.Id == id);
        if (file is null) return null;

        var stream = await fileStorageService.DownloadAsync(file.ObjectKey);
        return (stream, file.MimeType, file.OriginalFilename);
    }

    public async Task<InlineAttachmentResult?> UploadInlineAsync(int ticketId, IFormFile file)
    {
        var ticketExists = await db.Tickets.AnyAsync(t => t.Id == ticketId);
        if (!ticketExists) return null;

        var fileName = Path.GetFileName(file.FileName);
        var objectKey = $"tickets/{ticketId}/inline/{Guid.NewGuid()}-{fileName}";

        using var stream = file.OpenReadStream();
        await fileStorageService.UploadAsync(objectKey, stream, file.Length, file.ContentType);

        var entry = new FileStorage
        {
            TicketId = ticketId,
            MessageId = null,
            StorageBackend = StorageBackend.Minio,
            BucketOrPath = minioOptions.Value.Bucket,
            ObjectKey = objectKey,
            OriginalFilename = fileName,
            MimeType = file.ContentType ?? "image/png",
            FileSize = file.Length,
            IsInline = true,
        };
        db.FileStorages.Add(entry);
        await db.SaveChangesAsync();

        return new InlineAttachmentResult(entry.Id, $"/api/portal/attachments/{entry.Id}/download");
    }
}
