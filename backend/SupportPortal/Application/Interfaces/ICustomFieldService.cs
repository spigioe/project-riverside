using SupportPortal.Application.DTOs.CustomFields;

namespace SupportPortal.Application.Interfaces;

public enum CreateCustomFieldDefinitionResult { Success, FieldKeyTaken }

public enum UpdateCustomFieldDefinitionResult { Success, NotFound }

public enum CustomFieldValuesUpdateResult { Success, TicketNotFound, DefinitionNotFound, InvalidOptionValue }

public interface ICustomFieldService
{
    Task<IReadOnlyList<CustomFieldDefinitionDto>> GetDefinitionsAsync();
    Task<(CreateCustomFieldDefinitionResult Result, CustomFieldDefinitionDto? Field)> CreateDefinitionAsync(CreateCustomFieldDefinitionRequest request, int currentUserId);
    Task<UpdateCustomFieldDefinitionResult> UpdateDefinitionAsync(int id, UpdateCustomFieldDefinitionRequest request);
    Task<bool> DeactivateDefinitionAsync(int id);

    Task<IReadOnlyList<CustomFieldValueDto>?> GetValuesAsync(int ticketId);
    Task<CustomFieldValuesUpdateResult> UpdateValuesAsync(int ticketId, IReadOnlyList<UpdateCustomFieldValueItem> values);
}
