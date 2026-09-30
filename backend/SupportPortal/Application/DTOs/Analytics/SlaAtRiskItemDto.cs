namespace SupportPortal.Application.DTOs.Analytics;

public record SlaAtRiskItemDto(
    int Id,
    string Subject,
    string Status,
    string Priority,
    string? AssignedToName,
    DateTime SlaDueAt,
    double MinutesRemaining);
