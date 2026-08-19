using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Analytics;

public record TicketsByStatusDto(TicketStatus Status, int Count);
