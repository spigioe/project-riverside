namespace SupportPortal.Application.DTOs;

public record InboundEmail(
    string MessageId,
    string From,
    string To,
    string Subject,
    string Body,
    string? InReplyTo,
    string? References,
    DateTime ReceivedAt,
    IReadOnlyList<InboundEmailAttachment> Attachments
);

public record InboundEmailAttachment(string Filename, string ContentType, byte[] Data);
