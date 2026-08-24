using FluentValidation;
using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.Validators.Tickets;

public class UpdateTicketTypeRequestValidator : AbstractValidator<UpdateTicketTypeRequest>
{
    public UpdateTicketTypeRequestValidator()
    {
        RuleFor(x => x.Type)
            .MaximumLength(100)
            .When(x => x.Type != null)
            .WithMessage("A típus neve túl hosszú.");
    }
}
