using System.Text.RegularExpressions;
using FluentValidation;
using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.Validators.Tickets;

public partial class CreateTicketMessageRequestValidator : AbstractValidator<CreateTicketMessageRequest>
{
    public CreateTicketMessageRequestValidator()
    {
        RuleFor(x => x.Body)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("Az üzenet szövegének megadása kötelező.")
            .NotEmpty().WithMessage("Az üzenet szövegének megadása kötelező.")
            .MaximumLength(10000).WithMessage("Az üzenet legfeljebb 10000 karakter lehet.");

        RuleFor(x => x.Cc)
            .Must(BeAValidEmailList).WithMessage("A CC mező érvénytelen email címet tartalmaz.")
            .When(x => !string.IsNullOrWhiteSpace(x.Cc));

        RuleFor(x => x.Bcc)
            .Must(BeAValidEmailList).WithMessage("A BCC mező érvénytelen email címet tartalmaz.")
            .When(x => !string.IsNullOrWhiteSpace(x.Bcc));
    }

    private static bool BeAValidEmailList(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return true;

        return value.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(e => e.Trim())
            .All(e => EmailRegex().IsMatch(e));
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();
}
