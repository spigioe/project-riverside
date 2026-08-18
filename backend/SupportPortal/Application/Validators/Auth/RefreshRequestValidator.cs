using FluentValidation;
using SupportPortal.Application.DTOs.Auth;

namespace SupportPortal.Application.Validators.Auth;

public class RefreshRequestValidator : AbstractValidator<RefreshRequest>
{
    public RefreshRequestValidator()
    {
        RuleFor(x => x.RefreshToken)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A refresh token megadása kötelező.")
            .NotEmpty().WithMessage("A refresh token megadása kötelező.");
    }
}
