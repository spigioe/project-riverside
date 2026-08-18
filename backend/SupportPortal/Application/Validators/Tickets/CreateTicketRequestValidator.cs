using FluentValidation;
using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.Validators.Tickets;

public class CreateTicketRequestValidator : AbstractValidator<CreateTicketRequest>
{
    public CreateTicketRequestValidator()
    {
        RuleFor(x => x.Subject)
            .NotEmpty().WithMessage("A tárgy megadása kötelező.")
            .MaximumLength(300).WithMessage("A tárgy legfeljebb 300 karakter lehet.");

        RuleFor(x => x.Body)
            .NotEmpty().WithMessage("A leírás megadása kötelező.")
            .MaximumLength(10000).WithMessage("A leírás legfeljebb 10000 karakter lehet.");

        RuleFor(x => x.Priority)
            .IsInEnum().WithMessage("Érvénytelen prioritás érték.");

        RuleFor(x => x.CategoryId)
            .GreaterThan(0).WithMessage("Érvénytelen kategória azonosító.")
            .When(x => x.CategoryId.HasValue);

        RuleFor(x => x.RequesterEmail)
            .NotEmpty().WithMessage("A bejelentő email címének megadása kötelező.")
            .EmailAddress().WithMessage("Érvénytelen email cím formátum.")
            .MaximumLength(255).WithMessage("Az email cím legfeljebb 255 karakter lehet.");

        RuleFor(x => x.RequesterName)
            .NotEmpty().WithMessage("A bejelentő nevének megadása kötelező.")
            .MaximumLength(200).WithMessage("A bejelentő neve legfeljebb 200 karakter lehet.");

        RuleFor(x => x.AssignedToId)
            .GreaterThan(0).WithMessage("Érvénytelen hozzárendelt felhasználó azonosító.")
            .When(x => x.AssignedToId.HasValue);
    }
}
