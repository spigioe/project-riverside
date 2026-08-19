using FluentValidation;
using SupportPortal.Application.DTOs.CannedResponses;

namespace SupportPortal.Application.Validators.CannedResponses;

public class CreateCannedResponseRequestValidator : AbstractValidator<CreateCannedResponseRequest>
{
    public CreateCannedResponseRequestValidator()
    {
        RuleFor(x => x.FolderId)
            .GreaterThan(0).WithMessage("Érvénytelen mappa azonosító.");

        RuleFor(x => x.Title)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A cím megadása kötelező.")
            .NotEmpty().WithMessage("A cím megadása kötelező.")
            .MaximumLength(200).WithMessage("A cím legfeljebb 200 karakter lehet.");

        RuleFor(x => x.Body)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A szöveg megadása kötelező.")
            .NotEmpty().WithMessage("A szöveg megadása kötelező.")
            .MaximumLength(10000).WithMessage("A szöveg legfeljebb 10000 karakter lehet.");
    }
}
