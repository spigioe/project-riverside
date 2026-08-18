using FluentValidation;
using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.Validators.Tickets;

public class UpdateTicketRequestValidator : AbstractValidator<UpdateTicketRequest>
{
    public UpdateTicketRequestValidator()
    {
        RuleFor(x => x.Subject)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A tárgy megadása kötelező.")
            .NotEmpty().WithMessage("A tárgy megadása kötelező.")
            .MaximumLength(300).WithMessage("A tárgy legfeljebb 300 karakter lehet.");

        RuleFor(x => x.Body)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A leírás megadása kötelező.")
            .NotEmpty().WithMessage("A leírás megadása kötelező.")
            .MaximumLength(10000).WithMessage("A leírás legfeljebb 10000 karakter lehet.");

        RuleFor(x => x.Priority)
            .IsInEnum().WithMessage("Érvénytelen prioritás érték.");

        RuleFor(x => x.CategoryId)
            .GreaterThan(0).WithMessage("Érvénytelen kategória azonosító.")
            .When(x => x.CategoryId.HasValue);

        RuleFor(x => x.RequesterEmail)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A bejelentő email címének megadása kötelező.")
            .NotEmpty().WithMessage("A bejelentő email címének megadása kötelező.")
            .EmailAddress().WithMessage("Érvénytelen email cím formátum.")
            .MaximumLength(255).WithMessage("Az email cím legfeljebb 255 karakter lehet.");

        RuleFor(x => x.RequesterName)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("A bejelentő nevének megadása kötelező.")
            .NotEmpty().WithMessage("A bejelentő nevének megadása kötelező.")
            .MaximumLength(200).WithMessage("A bejelentő neve legfeljebb 200 karakter lehet.");
    }
}
