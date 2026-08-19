using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.DTOs.UserPreferences;

public record UserPreferenceDto(
    bool TicketPropertiesAutosave,
    TicketListView TicketListView,
    TicketDetailView TicketDetailView,
    bool TicketDetailSplitReversed);

public record UpdateUserPreferenceRequest(
    bool TicketPropertiesAutosave,
    TicketListView TicketListView,
    TicketDetailView TicketDetailView,
    bool TicketDetailSplitReversed);
