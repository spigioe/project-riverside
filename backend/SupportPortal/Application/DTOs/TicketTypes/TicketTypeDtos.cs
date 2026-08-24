namespace SupportPortal.Application.DTOs.TicketTypes;

public record TicketTypeDto(int Id, string Name, string? Description, int DisplayOrder, bool IsActive, bool IsSystem);

public record CreateTicketTypeRequest(string Name, string? Description);

public record UpdateTicketTypeDefinitionRequest(string Name, string? Description);

public record ReorderTicketTypesRequest(IReadOnlyList<ReorderTicketTypeItem> Items);

public record ReorderTicketTypeItem(int Id, int DisplayOrder);
