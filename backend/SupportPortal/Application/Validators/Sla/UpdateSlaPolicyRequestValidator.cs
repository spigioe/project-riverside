using FluentValidation;
using SupportPortal.Application.DTOs.Sla;

namespace SupportPortal.Application.Validators.Sla;

public class UpdateSlaPolicyRequestValidator : AbstractValidator<UpdateSlaPolicyRequest>
{
    public UpdateSlaPolicyRequestValidator()
    {
        RuleFor(x => x.ResponseTimeMinutes)
            .GreaterThan(0).WithMessage("A válaszidőnek pozitívnak kell lennie.");

        RuleFor(x => x.ResolutionTimeMinutes)
            .GreaterThan(0).WithMessage("A megoldási időnek pozitívnak kell lennie.")
            .GreaterThanOrEqualTo(x => x.ResponseTimeMinutes)
            .WithMessage("A megoldási idő nem lehet kisebb, mint a válaszidő.");
    }
}
