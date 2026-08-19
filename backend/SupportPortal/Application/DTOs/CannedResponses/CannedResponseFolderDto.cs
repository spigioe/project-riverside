namespace SupportPortal.Application.DTOs.CannedResponses;

public record CannedResponseFolderDto(int Id, string Name, int? CategoryId, string? CategoryName, int DisplayOrder);

public record CreateCannedResponseFolderRequest(string Name, int? CategoryId, int DisplayOrder);

public record UpdateCannedResponseFolderRequest(string Name, int? CategoryId, int DisplayOrder);
