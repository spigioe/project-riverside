using SupportPortal.Application.DTOs.Common;
using SupportPortal.Application.DTOs.Tickets;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.Interfaces;

public enum TicketAssignResult { Success, TicketNotFound, UserNotFound }

public enum TicketMergeResult { Success, TicketNotFound, TargetNotFound, SelfMerge, SourceAlreadyMerged, TargetAlreadyMerged }

public interface ITicketService
{
    Task<PagedResult<TicketListItemDto>> GetTicketsAsync(TicketListQuery query);
    Task<TicketDetailDto?> GetTicketByIdAsync(int id);
    Task<TicketDetailDto> CreateTicketAsync(CreateTicketRequest request, int currentUserId, TicketSource source = TicketSource.Manual);
    Task<bool> UpdateTicketAsync(int id, UpdateTicketRequest request);
    Task<bool> UpdateStatusAsync(int id, TicketStatus status, int currentUserId);
    Task<TicketAssignResult> AssignAsync(int id, int? assignedToId, int currentUserId);
    Task<bool?> ToggleCsmAsync(int id, int currentUserId);
    Task<TicketMergeResult> MergeAsync(int id, int targetTicketId);
    Task<IReadOnlyList<TicketMessageDto>?> GetMessagesAsync(int ticketId);
    Task<TicketMessageDto?> AddMessageAsync(int ticketId, CreateTicketMessageRequest request, int currentUserId);
}
