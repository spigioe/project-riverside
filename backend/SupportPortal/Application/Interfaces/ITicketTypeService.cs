using SupportPortal.Application.DTOs.TicketTypes;

namespace SupportPortal.Application.Interfaces;

public enum CreateTicketTypeResult { Success, NameTaken }
public enum UpdateTicketTypeDefinitionResult { Success, NotFound, NameTaken, SystemType }
public enum DeleteTicketTypeResult { Success, NotFound, SystemType, InUse }

public interface ITicketTypeService
{
    Task<IReadOnlyList<TicketTypeDto>> GetAllAsync();
    Task<(CreateTicketTypeResult Result, TicketTypeDto? Dto)> CreateAsync(CreateTicketTypeRequest request);
    Task<UpdateTicketTypeDefinitionResult> UpdateAsync(int id, UpdateTicketTypeDefinitionRequest request);
    Task<DeleteTicketTypeResult> DeleteAsync(int id);
    Task ReorderAsync(ReorderTicketTypesRequest request);
}
