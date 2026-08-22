using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.Interfaces;

public interface IAttachmentService
{
    Task<IReadOnlyList<AttachmentDto>?> GetForTicketAsync(int ticketId);
    Task<(Stream Stream, string ContentType, string FileName)?> GetDownloadAsync(int id);
}
