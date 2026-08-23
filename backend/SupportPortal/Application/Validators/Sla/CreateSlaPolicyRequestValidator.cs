using FluentValidation;
using SupportPortal.Application.DTOs.Sla;

namespace SupportPortal.Application.Validators.Sla;

public class CreateSlaPolicyRequestValidator : AbstractValidator<CreateSlaPolicyRequest>
{
    private static readonly string[] ValidPriorities = ["Low", "Medium", "High", "Urgent"];

    public CreateSlaPolicyRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("A policy neve nem lehet üres.")
            .MaximumLength(100).WithMessage("A policy neve legfeljebb 100 karakter lehet.");

        RuleFor(x => x.Priorities)
            .NotNull().WithMessage("A prioritás sorok megadása kötelező.")
            .Must(p => p != null && p.Count == 4).WithMessage("Mind a 4 prioritást meg kell adni (Low, Medium, High, Urgent).");

        RuleForEach(x => x.Priorities).ChildRules(p =>
        {
            p.RuleFor(r => r.Priority)
                .Must(v => ValidPriorities.Contains(v)).WithMessage("Érvénytelen prioritás értéke. Lehetséges értékek: Low, Medium, High, Urgent.");
            p.RuleFor(r => r.ResponseTimeMinutes)
                .GreaterThan(0).WithMessage("A válaszidőnek pozitívnak kell lennie.");
            p.RuleFor(r => r.ResolutionTimeMinutes)
                .GreaterThan(0).When(r => r.ResolutionTimeMinutes.HasValue)
                .WithMessage("A megoldási időnek pozitívnak kell lennie.");
        });

        RuleFor(x => x.CompanyIds)
            .NotNull().WithMessage("A cégek listája nem lehet null.");
    }
}
