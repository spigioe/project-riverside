namespace SupportPortal.Application.DTOs.CustomStatuses;

public record CustomStatusDto(
    int Id,
    string Key,
    string Name,
    string ColorVariant,
    string IconKey,
    int DisplayOrder,
    bool IsActive
);

public record CreateCustomStatusRequest(
    string Key,
    string Name,
    string ColorVariant,
    string IconKey,
    int DisplayOrder
);

public record UpdateCustomStatusRequest(
    string Key,
    string Name,
    string ColorVariant,
    string IconKey,
    int DisplayOrder,
    bool IsActive
);

public record AssignCustomStatusRequest(string? Key);
