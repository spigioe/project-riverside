using FluentValidation;
using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.Validators.Tickets;

public class UpdateTicketTypeRequestValidator : AbstractValidator<UpdateTicketTypeRequest>
{
    public UpdateTicketTypeRequestValidator()
    {
        RuleFor(x => x.Type)
            .IsInEnum()
            .When(x => x.Type.HasValue)
            .WithMessage("Érvénytelen jegy típus.");
    }
}
