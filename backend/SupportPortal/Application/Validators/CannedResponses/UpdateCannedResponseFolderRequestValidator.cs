using FluentValidation;
using SupportPortal.Application.DTOs.CannedResponses;

namespace SupportPortal.Application.Validators.CannedResponses;

public class UpdateCannedResponseFolderRequestValidator : AbstractValidator<UpdateCannedResponseFolderRequest>
{
    public UpdateCannedResponseFolderRequestValidator()
    {
        RuleFor(x => x.Name)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A mappa neve kötelező.")
            .NotEmpty().WithMessage("A mappa neve kötelező.")
            .MaximumLength(150).WithMessage("A mappa neve legfeljebb 150 karakter lehet.");

        RuleFor(x => x.CategoryId)
            .GreaterThan(0).WithMessage("Érvénytelen kategória azonosító.")
            .When(x => x.CategoryId.HasValue);
    }
}
