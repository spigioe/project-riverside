using FluentValidation;
using SupportPortal.Application.DTOs.Auth;

namespace SupportPortal.Application.Validators.Auth;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("Az email cím megadása kötelező.")
            .NotEmpty().WithMessage("Az email cím megadása kötelező.")
            .EmailAddress().WithMessage("Érvényes email cím szükséges.");

        RuleFor(x => x.Password)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A jelszó megadása kötelező.")
            .NotEmpty().WithMessage("A jelszó megadása kötelező.");
    }
}
