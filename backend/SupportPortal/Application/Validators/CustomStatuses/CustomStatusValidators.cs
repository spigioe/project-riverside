using FluentValidation;
using SupportPortal.Application.DTOs.CustomStatuses;

namespace SupportPortal.Application.Validators.CustomStatuses;

public class CreateCustomStatusRequestValidator : AbstractValidator<CreateCustomStatusRequest>
{
    private static readonly string[] AllowedColors = ["gray", "primary", "amber", "green", "dark", "purple", "red"];
    private static readonly string[] AllowedIcons = [
        "circle-dot", "clock", "circle-check", "lock", "inbox", "hourglass",
        "wrench", "ban", "arrow-right", "star", "phone", "comment", "fire", "circle-question"
    ];

    public CreateCustomStatusRequestValidator()
    {
        RuleFor(x => x.Key)
            .NotEmpty().WithMessage("A kulcs megadása kötelező.")
            .MaximumLength(80).WithMessage("A kulcs legfeljebb 80 karakter lehet.")
            .Matches("^[a-z0-9-]+$").WithMessage("A kulcs csak kisbetűket, számokat és kötőjelet tartalmazhat.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("A megnevezés megadása kötelező.")
            .MaximumLength(80).WithMessage("A megnevezés legfeljebb 80 karakter lehet.");

        RuleFor(x => x.ColorVariant)
            .Must(v => AllowedColors.Contains(v)).WithMessage("Érvénytelen szín.");

        RuleFor(x => x.IconKey)
            .Must(v => AllowedIcons.Contains(v)).WithMessage("Érvénytelen ikon.");
    }
}

public class UpdateCustomStatusRequestValidator : AbstractValidator<UpdateCustomStatusRequest>
{
    private static readonly string[] AllowedColors = ["gray", "primary", "amber", "green", "dark", "purple", "red"];
    private static readonly string[] AllowedIcons = [
        "circle-dot", "clock", "circle-check", "lock", "inbox", "hourglass",
        "wrench", "ban", "arrow-right", "star", "phone", "comment", "fire", "circle-question"
    ];

    public UpdateCustomStatusRequestValidator()
    {
        RuleFor(x => x.Key)
            .NotEmpty().WithMessage("A kulcs megadása kötelező.")
            .MaximumLength(80).WithMessage("A kulcs legfeljebb 80 karakter lehet.")
            .Matches("^[a-z0-9-]+$").WithMessage("A kulcs csak kisbetűket, számokat és kötőjelet tartalmazhat.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("A megnevezés megadása kötelező.")
            .MaximumLength(80).WithMessage("A megnevezés legfeljebb 80 karakter lehet.");

        RuleFor(x => x.ColorVariant)
            .Must(v => AllowedColors.Contains(v)).WithMessage("Érvénytelen szín.");

        RuleFor(x => x.IconKey)
            .Must(v => AllowedIcons.Contains(v)).WithMessage("Érvénytelen ikon.");
    }
}
