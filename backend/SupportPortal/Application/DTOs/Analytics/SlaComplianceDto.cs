namespace SupportPortal.Application.DTOs.Analytics;

public record SlaComplianceDto(int TotalWithSla, int Compliant, int Breached, double CompliancePercentage);
