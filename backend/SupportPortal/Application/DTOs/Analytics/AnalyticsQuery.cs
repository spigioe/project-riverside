namespace SupportPortal.Application.DTOs.Analytics;

public record AnalyticsQuery(DateTime? From = null, DateTime? To = null, string? Scope = "all");
