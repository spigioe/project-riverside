using FluentValidation;
using SupportPortal.Application.DTOs.Companies;

namespace SupportPortal.Application.Validators.Companies;

public class CreateCompanyRequestValidator : AbstractValidator<CreateCompanyRequest>
{
    public CreateCompanyRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("A cég neve megadása kötelező.")
            .MaximumLength(200).WithMessage("A cég neve legfeljebb 200 karakter lehet.");
        RuleFor(x => x.Domain).MaximumLength(200).WithMessage("A domain legfeljebb 200 karakter lehet.")
            .When(x => x.Domain != null);
    }
}

public class UpdateCompanyRequestValidator : AbstractValidator<UpdateCompanyRequest>
{
    public UpdateCompanyRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("A cég neve megadása kötelező.")
            .MaximumLength(200).WithMessage("A cég neve legfeljebb 200 karakter lehet.");
        RuleFor(x => x.Domain).MaximumLength(200).WithMessage("A domain legfeljebb 200 karakter lehet.")
            .When(x => x.Domain != null);
    }
}
