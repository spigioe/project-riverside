using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.UserPreferences;

public record UserPreferenceDto(bool TicketPropertiesAutosave, TicketListView TicketListView);

public record UpdateUserPreferenceRequest(bool TicketPropertiesAutosave, TicketListView TicketListView);
