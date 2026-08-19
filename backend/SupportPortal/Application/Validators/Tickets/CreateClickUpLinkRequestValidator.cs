using FluentValidation;
using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.Validators.Tickets;

public class CreateClickUpLinkRequestValidator : AbstractValidator<CreateClickUpLinkRequest>
{
    public CreateClickUpLinkRequestValidator()
    {
        RuleFor(x => x.ClickUpTaskId)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A ClickUp task ID megadása kötelező.")
            .NotEmpty().WithMessage("A ClickUp task ID megadása kötelező.")
            .MaximumLength(50).WithMessage("A ClickUp task ID túl hosszú.");

        RuleFor(x => x.ClickUpTaskUrl)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A ClickUp task URL megadása kötelező.")
            .NotEmpty().WithMessage("A ClickUp task URL megadása kötelező.")
            .MaximumLength(1000).WithMessage("A ClickUp task URL túl hosszú.")
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out _))
            .WithMessage("Érvénytelen URL formátum.");

        RuleFor(x => x.ClickUpTaskTitle)
            .MaximumLength(255).WithMessage("A feladat címe túl hosszú.");

        RuleFor(x => x.Notes)
            .MaximumLength(1000).WithMessage("A megjegyzés túl hosszú.");
    }
}
