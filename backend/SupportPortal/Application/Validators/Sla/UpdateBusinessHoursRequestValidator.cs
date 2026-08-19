using FluentValidation;
using SupportPortal.Application.DTOs.Sla;

namespace SupportPortal.Application.Validators.Sla;

public class UpdateBusinessHoursRequestValidator : AbstractValidator<UpdateBusinessHoursRequest>
{
    public UpdateBusinessHoursRequestValidator()
    {
        RuleFor(x => x.Days)
            .NotNull().WithMessage("A napok listájának megadása kötelező.");

        RuleForEach(x => x.Days).ChildRules(day =>
        {
            day.RuleFor(d => d.EndTime)
                .GreaterThan(d => d.StartTime)
                .When(d => d.IsEnabled && d.StartTime.HasValue && d.EndTime.HasValue)
                .WithMessage("A záró időpontnak a nyitó időpont után kell lennie.");

            day.RuleFor(d => d.StartTime)
                .NotNull()
                .When(d => d.IsEnabled)
                .WithMessage("Bekapcsolt napnál a nyitó időpont megadása kötelező.");

            day.RuleFor(d => d.EndTime)
                .NotNull()
                .When(d => d.IsEnabled)
                .WithMessage("Bekapcsolt napnál a záró időpont megadása kötelező.");
        });
    }
}
