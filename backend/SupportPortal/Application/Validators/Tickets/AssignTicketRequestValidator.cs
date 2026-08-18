using FluentValidation;
using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.Validators.Tickets;

public class AssignTicketRequestValidator : AbstractValidator<AssignTicketRequest>
{
    public AssignTicketRequestValidator()
    {
        RuleFor(x => x.AssignedToId)
            .GreaterThan(0).WithMessage("Érvénytelen felhasználó azonosító.")
            .When(x => x.AssignedToId.HasValue);
    }
}
