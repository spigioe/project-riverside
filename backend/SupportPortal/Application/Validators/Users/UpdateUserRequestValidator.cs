using FluentValidation;
using SupportPortal.Application.DTOs.Users;

namespace SupportPortal.Application.Validators.Users;

public class UpdateUserRequestValidator : AbstractValidator<UpdateUserRequest>
{
    public UpdateUserRequestValidator()
    {
        RuleFor(x => x.FullName)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A név megadása kötelező.")
            .NotEmpty().WithMessage("A név megadása kötelező.")
            .MaximumLength(200).WithMessage("A név legfeljebb 200 karakter lehet.");

        RuleFor(x => x.RoleId)
            .GreaterThan(0).WithMessage("Érvénytelen szerepkör azonosító.");
    }
}
