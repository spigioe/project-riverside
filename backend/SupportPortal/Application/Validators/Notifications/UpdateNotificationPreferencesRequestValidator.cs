using FluentValidation;
using SupportPortal.Application.DTOs.Notifications;

namespace SupportPortal.Application.Validators.Notifications;

public class UpdateNotificationPreferencesRequestValidator : AbstractValidator<UpdateNotificationPreferencesRequest>
{
    public UpdateNotificationPreferencesRequestValidator()
    {
        RuleFor(x => x.Preferences)
            .NotNull().WithMessage("A preferenciák listájának megadása kötelező.");

        RuleForEach(x => x.Preferences).ChildRules(p =>
        {
            p.RuleFor(x => x.TriggerType).IsInEnum().WithMessage("Érvénytelen trigger típus.");
        });
    }
}
