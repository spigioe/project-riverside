using SupportPortal.Application.DTOs;

namespace SupportPortal.Application.Interfaces;

public interface IEmailService
{
    /// <summary>Elküldi az emailt, és visszaadja a kimenő üzenet Message-ID-jét (szálazáshoz).</summary>
    Task<string> SendAsync(string to, string subject, string body, string? inReplyTo, string? references);

    Task<List<InboundEmail>> FetchNewAsync();
}
