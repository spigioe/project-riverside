using SupportPortal.Application.DTOs.Tickets;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.Interfaces;

public interface IClickUpLinkService
{
    Task<IReadOnlyList<ClickUpLinkDto>?> GetLinksAsync(int ticketId);
    Task<ClickUpLinkDto?> AddLinkAsync(int ticketId, CreateClickUpLinkRequest request, int currentUserId);
    Task<bool> DeleteLinkAsync(int ticketId, int linkId, int currentUserId);
    Task<ClickUpLinkDto?> SyncLinkAsync(int ticketId, int linkId, ClickUpSyncTrigger trigger);
    Task SyncTicketLinksAsync(int ticketId, ClickUpSyncTrigger trigger);
    Task SyncAllActiveLinksAsync(ClickUpSyncTrigger trigger);
}
