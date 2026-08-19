using FluentValidation;
using SupportPortal.Application.DTOs.Sla;

namespace SupportPortal.Application.Validators.Sla;

public class CreateSlaDomainRequestValidator : AbstractValidator<CreateSlaDomainRequest>
{
    public CreateSlaDomainRequestValidator()
    {
        RuleFor(x => x.SlaPolicyId)
            .GreaterThan(0).WithMessage("Érvénytelen SLA policy azonosító.");

        RuleFor(x => x.EmailDomain)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A domain megadása kötelező.")
            .NotEmpty().WithMessage("A domain megadása kötelező.")
            .MaximumLength(255).WithMessage("A domain legfeljebb 255 karakter lehet.")
            .Matches(@"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$")
            .WithMessage("Érvénytelen domain formátum.");
    }
}
