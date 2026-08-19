using FluentValidation;
using SupportPortal.Application.DTOs.Categories;

namespace SupportPortal.Application.Validators.Categories;

public class UpdateCategoryRequestValidator : AbstractValidator<UpdateCategoryRequest>
{
    public UpdateCategoryRequestValidator()
    {
        RuleFor(x => x.Name)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A kategória neve kötelező.")
            .NotEmpty().WithMessage("A kategória neve kötelező.")
            .MaximumLength(150).WithMessage("A kategória neve legfeljebb 150 karakter lehet.");

        RuleFor(x => x.ParentId)
            .GreaterThan(0).WithMessage("Érvénytelen szülő kategória azonosító.")
            .When(x => x.ParentId.HasValue);
    }
}
