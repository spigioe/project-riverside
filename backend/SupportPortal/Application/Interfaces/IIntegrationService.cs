using SupportPortal.Application.DTOs.Integration;

namespace SupportPortal.Application.Interfaces;

public interface IIntegrationService
{
    Task<ClickUpConfigDto> GetClickUpConfigAsync();
    Task<ClickUpConfigDto> UpdateClickUpConfigAsync(UpdateClickUpConfigRequest request, int currentUserId);
    Task<TestClickUpConnectionResponse> TestClickUpConnectionAsync();
}
