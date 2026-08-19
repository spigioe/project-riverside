using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Ai;

public record AiSummaryResponse(string Summary);

public record AiSuggestReplyResponse(string SuggestedReply);

public record AiClassifyResponse(int? SuggestedCategoryId, string? SuggestedCategoryName, TicketPriority SuggestedPriority);
