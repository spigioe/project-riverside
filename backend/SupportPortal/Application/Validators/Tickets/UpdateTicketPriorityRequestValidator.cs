using FluentValidation;
using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.Validators.Tickets;

public class UpdateTicketPriorityRequestValidator : AbstractValidator<UpdateTicketPriorityRequest>
{
    public UpdateTicketPriorityRequestValidator()
    {
        RuleFor(x => x.Priority)
            .IsInEnum().WithMessage("Érvénytelen prioritás érték.");
    }
}
