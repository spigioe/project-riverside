using FluentValidation;
using SupportPortal.Application.DTOs.ApiKeys;

namespace SupportPortal.Application.Validators.ApiKeys;

public class CreateApiKeyRequestValidator : AbstractValidator<CreateApiKeyRequest>
{
    public CreateApiKeyRequestValidator()
    {
        RuleFor(x => x.Name)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A kulcs nevének megadása kötelező.")
            .NotEmpty().WithMessage("A kulcs nevének megadása kötelező.")
            .MaximumLength(150).WithMessage("A név legfeljebb 150 karakter lehet.");

        RuleFor(x => x.ExpiresAt)
            .GreaterThan(DateTime.UtcNow).WithMessage("A lejárati dátumnak a jövőben kell lennie.")
            .When(x => x.ExpiresAt.HasValue);
    }
}
