namespace SupportPortal.Application.Interfaces;

public record TemplateContext(
    int TicketId,
    string TicketSubject,
    string TicketStatus,
    string TicketPriority,
    string TicketCreatedAt,
    string? ContactName,
    string? ContactEmail,
    string? ContactCompany,
    string? AgentName,
    string? AgentEmail,
    string PortalUrl);

public interface ITemplateService
{
    string Render(string template, TemplateContext context);
}
