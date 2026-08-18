using FluentValidation;
using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.Validators.Tickets;

public class MergeTicketRequestValidator : AbstractValidator<MergeTicketRequest>
{
    public MergeTicketRequestValidator()
    {
        RuleFor(x => x.TargetTicketId)
            .GreaterThan(0).WithMessage("Érvénytelen cél jegy azonosító.");
    }
}
