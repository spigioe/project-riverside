using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Data.Configurations;

public class SlaPolicyPriorityConfiguration : IEntityTypeConfiguration<SlaPolicyPriority>
{
    public void Configure(EntityTypeBuilder<SlaPolicyPriority> builder)
    {
        builder.HasIndex(p => new { p.SlaPolicyId, p.Priority }).IsUnique();

        builder.HasOne(p => p.SlaPolicy)
            .WithMany(s => s.Priorities)
            .HasForeignKey(p => p.SlaPolicyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
