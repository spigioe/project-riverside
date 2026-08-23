using FluentValidation;
using SupportPortal.Application.DTOs.Contacts;

namespace SupportPortal.Application.Validators.Contacts;

public class CreateContactRequestValidator : AbstractValidator<CreateContactRequest>
{
    public CreateContactRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().WithMessage("Az email cím megadása kötelező.")
            .EmailAddress().WithMessage("Érvénytelen email cím formátum.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("A kontakt neve megadása kötelező.")
            .MaximumLength(200).WithMessage("A név legfeljebb 200 karakter lehet.");
    }
}

public class UpdateContactRequestValidator : AbstractValidator<UpdateContactRequest>
{
    public UpdateContactRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().WithMessage("Az email cím megadása kötelező.")
            .EmailAddress().WithMessage("Érvénytelen email cím formátum.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("A kontakt neve megadása kötelező.")
            .MaximumLength(200).WithMessage("A név legfeljebb 200 karakter lehet.");
    }
}
