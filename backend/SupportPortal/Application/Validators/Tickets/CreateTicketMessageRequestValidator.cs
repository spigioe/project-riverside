using FluentValidation;
using SupportPortal.Application.DTOs.Tickets;

namespace SupportPortal.Application.Validators.Tickets;

public class CreateTicketMessageRequestValidator : AbstractValidator<CreateTicketMessageRequest>
{
    public CreateTicketMessageRequestValidator()
    {
        RuleFor(x => x.Body)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("Az üzenet szövegének megadása kötelező.")
            .NotEmpty().WithMessage("Az üzenet szövegének megadása kötelező.")
            .MaximumLength(10000).WithMessage("Az üzenet legfeljebb 10000 karakter lehet.");
    }
}
