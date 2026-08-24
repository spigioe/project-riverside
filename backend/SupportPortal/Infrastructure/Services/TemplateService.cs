using SupportPortal.Application.Interfaces;

namespace SupportPortal.Infrastructure.Services;

public class TemplateService : ITemplateService
{
    public string Render(string template, TemplateContext context)
    {
        return template
            .Replace("{{ticket.id}}", context.TicketId.ToString())
            .Replace("{{ticket.subject}}", context.TicketSubject)
            .Replace("{{ticket.status}}", context.TicketStatus)
            .Replace("{{ticket.priority}}", context.TicketPriority)
            .Replace("{{ticket.created_at}}", context.TicketCreatedAt)
            .Replace("{{contact.name}}", context.ContactName ?? "")
            .Replace("{{contact.email}}", context.ContactEmail ?? "")
            .Replace("{{contact.company}}", context.ContactCompany ?? "")
            .Replace("{{agent.name}}", context.AgentName ?? "")
            .Replace("{{agent.email}}", context.AgentEmail ?? "")
            .Replace("{{portal.url}}", context.PortalUrl);
    }
}
