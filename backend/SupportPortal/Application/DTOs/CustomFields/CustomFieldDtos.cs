using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.CustomFields;

public record CustomFieldDefinitionDto(
    int Id,
    string Name,
    string FieldKey,
    CustomFieldType FieldType,
    bool IsRequired,
    IReadOnlyList<string>? Options,
    int DisplayOrder,
    bool IsActive
);

public record CreateCustomFieldDefinitionRequest(
    string Name,
    string? FieldKey,
    CustomFieldType FieldType,
    bool IsRequired,
    IReadOnlyList<string>? Options,
    int DisplayOrder
);

public record UpdateCustomFieldDefinitionRequest(
    string Name,
    CustomFieldType FieldType,
    bool IsRequired,
    IReadOnlyList<string>? Options,
    int DisplayOrder
);

public record CustomFieldValueDto(
    int DefinitionId,
    string FieldKey,
    string Name,
    CustomFieldType FieldType,
    string? Value,
    IReadOnlyList<string>? Options
);

public record UpdateCustomFieldValueItem(int DefinitionId, string? Value);

// Redukált alak a Developer API-hoz (AI-nak átadható formátum) — nincs benne definitionId/options.
public record CustomFieldSummaryDto(string FieldKey, string Name, CustomFieldType FieldType, string? Value);
