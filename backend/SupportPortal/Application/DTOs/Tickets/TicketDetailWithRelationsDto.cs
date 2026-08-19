namespace SupportPortal.Application.DTOs.Tickets;

public record TicketDetailWithRelationsDto(
    TicketDetailDto Ticket,
    IReadOnlyList<TicketMessageDto> Messages,
    IReadOnlyList<ClickUpLinkDto> ClickUpLinks
);
