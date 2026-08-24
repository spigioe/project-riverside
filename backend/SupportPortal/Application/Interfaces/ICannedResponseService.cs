using SupportPortal.Application.DTOs.CannedResponses;

namespace SupportPortal.Application.Interfaces;

public enum CreateFolderResult { Success, CategoryNotFound }
public enum UpdateFolderResult { Success, NotFound, CategoryNotFound }
public enum DeleteFolderResult { Success, NotFound, HasResponses }

public enum CreateResponseResult { Success, FolderNotFound }
public enum UpdateResponseResult { Success, NotFound }

public interface ICannedResponseService
{
    Task<IReadOnlyList<CannedResponseFolderDto>> GetFoldersAsync();
    Task<(CreateFolderResult Result, CannedResponseFolderDto? Folder)> CreateFolderAsync(CreateCannedResponseFolderRequest request);
    Task<UpdateFolderResult> UpdateFolderAsync(int id, UpdateCannedResponseFolderRequest request);
    Task<DeleteFolderResult> DeleteFolderAsync(int id);
    Task ReorderFoldersAsync(ReorderCannedRequest request);

    Task<IReadOnlyList<CannedResponseDto>> GetResponsesAsync(int? folderId);
    Task<(CreateResponseResult Result, CannedResponseDto? Response)> CreateResponseAsync(CreateCannedResponseRequest request, int currentUserId);
    Task<UpdateResponseResult> UpdateResponseAsync(int id, UpdateCannedResponseRequest request);
    Task<bool> DeleteResponseAsync(int id);
    Task ReorderResponsesAsync(ReorderCannedRequest request);
}
