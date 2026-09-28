namespace SupportPortal.Application.DTOs.Analytics;

/// <summary>DayOfWeek: 0 = hétfő … 6 = vasárnap; Hour: 0–23 (a kliens időzónájában).</summary>
public record VolumeHeatmapCellDto(int DayOfWeek, int Hour, int Count);
