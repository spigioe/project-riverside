using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Tickets;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;

namespace SupportPortal.Infrastructure.Services;

public class AttachmentService(AppDbContext db, IFileStorageService fileStorageService) : IAttachmentService
{
    public async Task<IReadOnlyList<AttachmentDto>?> GetForTicketAsync(int ticketId)
    {
        var ticketExists = await db.Tickets.AnyAsync(t => t.Id == ticketId);
        if (!ticketExists) return null;

        return await db.FileStorages
            .AsNoTracking()
            .Where(f => f.Message.TicketId == ticketId)
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
}
