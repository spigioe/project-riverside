using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.Tickets;

public record UpdateTicketTypeRequest(TicketType? Type);
