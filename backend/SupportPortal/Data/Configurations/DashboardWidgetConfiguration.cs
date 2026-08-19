using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Data.Configurations;

public class DashboardWidgetConfiguration : IEntityTypeConfiguration<DashboardWidget>
{
    public void Configure(EntityTypeBuilder<DashboardWidget> builder)
    {
        builder.Property(w => w.WidgetType).HasConversion<string>();

        builder.HasIndex(w => new { w.UserId, w.WidgetType }).IsUnique();

        builder.HasOne(w => w.User)
            .WithMany(u => u.DashboardWidgets)
            .HasForeignKey(w => w.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
