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
            widget.RuleFor(w => w).Must(w => w.Col + w.ColSpan <= 8)
                .WithMessage("A widget nem lóghat ki a grid jobb szélén (oszlop + szélesség legfeljebb 8).");
            widget.RuleFor(w => w).Must(w => w.Row + w.RowSpan <= 10)
                .WithMessage("A widget nem lóghat ki a grid alján (sor + magasság legfeljebb 10).");
        });

        RuleFor(x => x.Widgets)
            .Must(NotOverlap).WithMessage("A widgetek nem fedhetik egymást.")
            .When(x => x.Widgets is not null);
    }

    private static bool NotOverlap(IReadOnlyList<UpdateDashboardWidgetItem> widgets)
    {
        for (var i = 0; i < widgets.Count; i++)
        for (var j = i + 1; j < widgets.Count; j++)
        {
            var a = widgets[i];
            var b = widgets[j];
            var separate = a.Col + a.ColSpan <= b.Col || b.Col + b.ColSpan <= a.Col
                || a.Row + a.RowSpan <= b.Row || b.Row + b.RowSpan <= a.Row;
            if (!separate) return false;
        }
        return true;
    }
}
