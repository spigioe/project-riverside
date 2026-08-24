using FluentValidation;
using SupportPortal.Application.DTOs.Dashboard;

namespace SupportPortal.Application.Validators.Dashboard;

public class UpdateDashboardWidgetsRequestValidator : AbstractValidator<UpdateDashboardWidgetsRequest>
{
    public UpdateDashboardWidgetsRequestValidator()
    {
        RuleFor(x => x.Widgets)
            .NotNull().WithMessage("A widget lista megadása kötelező.");

        RuleFor(x => x.Widgets)
            .Must(widgets => widgets.Select(w => w.WidgetType).Distinct().Count() == widgets.Count)
            .WithMessage("Egy widget típusból csak egy lehet userenként.")
            .When(x => x.Widgets is not null);

        RuleForEach(x => x.Widgets).ChildRules(widget =>
        {
            widget.RuleFor(w => w.WidgetType).IsInEnum().WithMessage("Érvénytelen widget típus.");
            widget.RuleFor(w => w.Col).InclusiveBetween(0, 7).WithMessage("Az oszlop értéke 0–7 közé kell essen.");
            widget.RuleFor(w => w.Row).InclusiveBetween(0, 9).WithMessage("A sor értéke 0–9 közé kell essen.");
            widget.RuleFor(w => w.ColSpan).InclusiveBetween(1, 8).WithMessage("A colSpan értéke 1–8 közé kell essen.");
            widget.RuleFor(w => w.RowSpan).InclusiveBetween(1, 10).WithMessage("A rowSpan értéke 1–10 közé kell essen.");
        });
    }
}
