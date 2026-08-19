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
            widget.RuleFor(w => w.PositionX).GreaterThanOrEqualTo(0).WithMessage("Érvénytelen X pozíció.");
            widget.RuleFor(w => w.PositionY).GreaterThanOrEqualTo(0).WithMessage("Érvénytelen Y pozíció.");
            widget.RuleFor(w => w.Width).GreaterThan(0).WithMessage("A szélesség legalább 1 kell legyen.");
            widget.RuleFor(w => w.Height).GreaterThan(0).WithMessage("A magasság legalább 1 kell legyen.");
        });
    }
}
