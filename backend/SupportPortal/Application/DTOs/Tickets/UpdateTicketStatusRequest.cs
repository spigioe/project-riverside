using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Tickets;

public record UpdateTicketStatusRequest(TicketStatus Status);
