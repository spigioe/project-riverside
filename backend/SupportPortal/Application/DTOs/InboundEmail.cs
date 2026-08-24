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
    IReadOnlyList<InboundEmailAttachment> Attachments,
    IReadOnlyList<EmailPart>? RawParts = null
);

public record InboundEmailAttachment(
    string Filename,
    string ContentType,
    string? ContentId,
    bool IsInline,
    byte[] Data
);

// Placeholder a jövőbeli multi-sender szétbontáshoz; egyelőre mindig null
public record EmailPart(string From, string Body, DateTime SentAt);
