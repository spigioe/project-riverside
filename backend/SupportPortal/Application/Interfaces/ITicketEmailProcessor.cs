using SupportPortal.Application.DTOs;

namespace SupportPortal.Application.Interfaces;

public interface ITicketEmailProcessor
{
    Task ProcessAsync(IReadOnlyList<InboundEmail> emails);
}
