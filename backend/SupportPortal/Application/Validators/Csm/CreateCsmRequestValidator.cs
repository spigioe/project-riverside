using FluentValidation;
using SupportPortal.Application.DTOs.Csm;

namespace SupportPortal.Application.Validators.Csm;

public class CreateCsmRequestValidator : AbstractValidator<CreateCsmRequest>
{
    public CreateCsmRequestValidator()
    {
        RuleFor(x => x.Name)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A név megadása kötelező.")
            .NotEmpty().WithMessage("A név megadása kötelező.")
            .MaximumLength(200).WithMessage("A név legfeljebb 200 karakter lehet.");

        RuleFor(x => x.Email)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("Az email cím megadása kötelező.")
            .NotEmpty().WithMessage("Az email cím megadása kötelező.")
            .EmailAddress().WithMessage("Érvénytelen email cím formátum.")
            .MaximumLength(255).WithMessage("Az email cím legfeljebb 255 karakter lehet.");

        RuleFor(x => x.Domains)
            .NotNull().WithMessage("A domainek megadása kötelező.");

        RuleForEach(x => x.Domains)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("A domain nem lehet üres.")
            .MaximumLength(255).WithMessage("A domain legfeljebb 255 karakter lehet.")
            .Matches(@"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$")
            .WithMessage("Érvénytelen domain formátum (csak a domain rész, @ jel nélkül, pl. \"mol.hu\").");
    }
}
