using FluentValidation;
using SupportPortal.Application.DTOs.Analytics;

namespace SupportPortal.Application.Validators.Analytics;

public class AnalyticsQueryValidator : AbstractValidator<AnalyticsQuery>
{
    private static readonly string[] AllowedScopes = ["all", "mine"];

    public AnalyticsQueryValidator()
    {
        RuleFor(x => x.Scope)
            .Must(s => s == null || AllowedScopes.Contains(s.ToLower()))
            .WithMessage("Érvénytelen scope érték. Lehetséges értékek: all, mine.");

        RuleFor(x => x)
            .Must(q => !q.From.HasValue || !q.To.HasValue || (q.To.Value - q.From.Value).TotalDays <= 366)
            .WithMessage("A dátumtartomány legfeljebb 1 év lehet.");

        RuleFor(x => x)
            .Must(q => !q.From.HasValue || !q.To.HasValue || q.From.Value <= q.To.Value)
            .WithMessage("A 'from' dátum nem lehet nagyobb a 'to' dátumnál.");
    }
}
