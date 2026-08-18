using FluentValidation;
using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.Validators.Tickets;

public class UpdateTicketStatusRequestValidator : AbstractValidator<UpdateTicketStatusRequest>
{
    public UpdateTicketStatusRequestValidator()
    {
        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Érvénytelen státusz érték.");
    }
}
