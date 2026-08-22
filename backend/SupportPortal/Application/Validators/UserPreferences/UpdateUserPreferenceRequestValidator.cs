using FluentValidation;
using SupportPortal.Application.DTOs.UserPreferences;

namespace SupportPortal.Application.Validators.UserPreferences;

public class UpdateUserPreferenceRequestValidator : AbstractValidator<UpdateUserPreferenceRequest>
{
    public UpdateUserPreferenceRequestValidator()
    {
        RuleFor(x => x.TicketListView).IsInEnum().WithMessage("Érvénytelen nézet típus.");
        RuleFor(x => x.TicketDetailView).IsInEnum().WithMessage("Érvénytelen jegy nézet típus.");
        RuleFor(x => x.EmailSignature).MaximumLength(2000).WithMessage("Az email aláírás legfeljebb 2000 karakter lehet.");
    }
}
