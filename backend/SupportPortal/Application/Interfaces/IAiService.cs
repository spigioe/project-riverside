using SupportPortal.Application.DTOs.Ai;

namespace SupportPortal.Application.Interfaces;

public enum AiOperationStatus { Success, TicketNotFound, Unavailable }

public record AiOperationResult<T>(AiOperationStatus Status, T? Data, string? ErrorMessage)
{
    public static AiOperationResult<T> Ok(T data) => new(AiOperationStatus.Success, data, null);
    public static AiOperationResult<T> NotFound() => new(AiOperationStatus.TicketNotFound, default, null);
    public static AiOperationResult<T> Unavailable(string message) => new(AiOperationStatus.Unavailable, default, message);
}

public interface IAiService
{
    Task<AiOperationResult<AiSummaryResponse>> SummarizeAsync(int ticketId, int currentUserId);
    Task<AiOperationResult<AiSuggestReplyResponse>> SuggestReplyAsync(int ticketId, int currentUserId);
    Task<AiOperationResult<AiClassifyResponse>> ClassifyAsync(int ticketId, int currentUserId);
}
