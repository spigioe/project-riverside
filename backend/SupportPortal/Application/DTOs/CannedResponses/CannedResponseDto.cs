namespace SupportPortal.Application.DTOs.CannedResponses;

public record CannedResponseDto(
    int Id, int FolderId, string Title, string Body, bool IsActive,
    int CreatedById, string CreatedByName, DateTime CreatedAt
);

public record CreateCannedResponseRequest(int FolderId, string Title, string Body);

public record UpdateCannedResponseRequest(string Title, string Body, bool IsActive);
