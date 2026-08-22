using System.Text.RegularExpressions;
using FluentValidation;
using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.Validators.Tickets;

public partial class CreateTicketMessageFormRequestValidator : AbstractValidator<CreateTicketMessageFormRequest>
{
    private const long MaxFileSizeBytes = 10 * 1024 * 1024;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".gif", ".txt", ".zip",
    };

    public CreateTicketMessageFormRequestValidator()
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

        RuleFor(x => x.Attachments)
            .Must(a => a is null || a.Count <= 5).WithMessage("Legfeljebb 5 fájl csatolható egyszerre.");

        RuleForEach(x => x.Attachments).ChildRules(attachment =>
        {
            attachment.RuleFor(f => f.Length)
                .LessThanOrEqualTo(MaxFileSizeBytes).WithMessage("Egy fájl mérete legfeljebb 10 MB lehet.");
            attachment.RuleFor(f => f.FileName)
                .Must(name => AllowedExtensions.Contains(Path.GetExtension(name)))
                .WithMessage("Nem engedélyezett fájltípus. Engedélyezett: pdf, doc, docx, xls, xlsx, png, jpg, gif, txt, zip.");
        });
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
