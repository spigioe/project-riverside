namespace SupportPortal.Application.DTOs.Tickets;

public record CreateTicketMessageRequest(string Body, bool IsInternalNote = false);
