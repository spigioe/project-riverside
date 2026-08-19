namespace SupportPortal.Application.DTOs.Analytics;

public record TicketsByCategoryDto(int? CategoryId, string CategoryName, int Count);
