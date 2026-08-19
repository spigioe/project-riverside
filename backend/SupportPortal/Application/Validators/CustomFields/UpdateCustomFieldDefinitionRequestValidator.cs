using FluentValidation;
using SupportPortal.Application.DTOs.CustomFields;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Application.Validators.CustomFields;

public class UpdateCustomFieldDefinitionRequestValidator : AbstractValidator<UpdateCustomFieldDefinitionRequest>
{
    public UpdateCustomFieldDefinitionRequestValidator()
    {
        RuleFor(x => x.Name)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A mező neve kötelező.")
            .NotEmpty().WithMessage("A mező neve kötelező.")
            .MaximumLength(200).WithMessage("A mező neve legfeljebb 200 karakter lehet.");

        RuleFor(x => x.FieldType)
            .IsInEnum().WithMessage("Érvénytelen mezőtípus.");

        RuleFor(x => x.Options)
            .NotEmpty().WithMessage("Legördülő típusnál legalább egy opció megadása kötelező.")
            .When(x => x.FieldType == CustomFieldType.Select);

        RuleForEach(x => x.Options)
            .NotEmpty().WithMessage("Az opció szövege nem lehet üres.")
            .When(x => x.FieldType == CustomFieldType.Select && x.Options is not null);

        RuleFor(x => x.DisplayOrder)
            .GreaterThanOrEqualTo(0).WithMessage("A sorrend nem lehet negatív.");
    }
}
