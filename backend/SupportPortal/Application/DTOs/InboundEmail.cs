namespace SupportPortal.Application.DTOs;

public record InboundEmail(
    string MessageId,
    string From,
    string To,
    string Subject,
    string Body,
    string? InReplyTo,
    string? References,
    DateTime ReceivedAt
);
