using FluentValidation;
using SupportPortal.Application.DTOs.UserPreferences;

namespace SupportPortal.Application.Validators.UserPreferences;

public class UpdateUserPreferenceRequestValidator : AbstractValidator<UpdateUserPreferenceRequest>
{
    public UpdateUserPreferenceRequestValidator()
    {
        RuleFor(x => x.TicketListView).IsInEnum().WithMessage("Érvénytelen nézet típus.");
    }
}
