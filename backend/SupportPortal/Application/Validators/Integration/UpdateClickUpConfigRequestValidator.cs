using FluentValidation;
using SupportPortal.Application.DTOs.Integration;

namespace SupportPortal.Application.Validators.Integration;

public class UpdateClickUpConfigRequestValidator : AbstractValidator<UpdateClickUpConfigRequest>
{
    public UpdateClickUpConfigRequestValidator()
    {
        RuleFor(x => x.ApiKey)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("Az API kulcs megadása kötelező.")
            .NotEmpty().WithMessage("Az API kulcs megadása kötelező.")
            .MaximumLength(500).WithMessage("Az API kulcs túl hosszú.");

        RuleFor(x => x.WorkspaceId)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A workspace ID megadása kötelező.")
            .NotEmpty().WithMessage("A workspace ID megadása kötelező.")
            .MaximumLength(100).WithMessage("A workspace ID túl hosszú.");
    }
}
