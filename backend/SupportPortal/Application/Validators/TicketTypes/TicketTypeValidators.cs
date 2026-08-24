using FluentValidation;
using SupportPortal.Application.DTOs.TicketTypes;

namespace SupportPortal.Application.Validators.TicketTypes;

public class CreateTicketTypeRequestValidator : AbstractValidator<CreateTicketTypeRequest>
{
    public CreateTicketTypeRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100).WithMessage("A típus neve kötelező és maximum 100 karakter lehet.");
        RuleFor(x => x.Description).MaximumLength(500).When(x => x.Description != null).WithMessage("A leírás maximum 500 karakter lehet.");
    }
}

public class UpdateTicketTypeDefinitionRequestValidator : AbstractValidator<UpdateTicketTypeDefinitionRequest>
{
    public UpdateTicketTypeDefinitionRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100).WithMessage("A típus neve kötelező és maximum 100 karakter lehet.");
        RuleFor(x => x.Description).MaximumLength(500).When(x => x.Description != null).WithMessage("A leírás maximum 500 karakter lehet.");
    }
}
