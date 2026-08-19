using FluentValidation;
using SupportPortal.Application.DTOs.Users;

namespace SupportPortal.Application.Validators.Users;

public class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.Email)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("Az email cím megadása kötelező.")
            .NotEmpty().WithMessage("Az email cím megadása kötelező.")
            .EmailAddress().WithMessage("Érvénytelen email cím formátum.")
            .MaximumLength(255).WithMessage("Az email cím legfeljebb 255 karakter lehet.");

        RuleFor(x => x.FullName)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A név megadása kötelező.")
            .NotEmpty().WithMessage("A név megadása kötelező.")
            .MaximumLength(200).WithMessage("A név legfeljebb 200 karakter lehet.");

        RuleFor(x => x.RoleId)
            .GreaterThan(0).WithMessage("Érvénytelen szerepkör azonosító.");

        RuleFor(x => x.Password)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A jelszó megadása kötelező.")
            .NotEmpty().WithMessage("A jelszó megadása kötelező.")
            .MinimumLength(8).WithMessage("A jelszónak legalább 8 karakter hosszúnak kell lennie.");
    }
}
