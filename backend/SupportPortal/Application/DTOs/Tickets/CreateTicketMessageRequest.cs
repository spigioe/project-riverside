namespace SupportPortal.Application.DTOs.Tickets;

public record CreateTicketMessageRequest(string Body, bool IsInternalNote = false, string? Cc = null, string? Bcc = null);
