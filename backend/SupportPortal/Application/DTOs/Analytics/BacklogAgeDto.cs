namespace SupportPortal.Application.DTOs.Analytics;

public record BacklogAgeBucketDto(string Key, string Label, int Low, int Medium, int High, int Urgent, int Total);

public record BacklogAgeDto(IReadOnlyList<BacklogAgeBucketDto> Buckets, int TotalOpen, double AverageAgeHours, int? OldestTicketId, double OldestAgeHours);
