using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Data.Configurations;

public class TicketCustomStatusConfiguration : IEntityTypeConfiguration<TicketCustomStatus>
{
    public void Configure(EntityTypeBuilder<TicketCustomStatus> builder)
    {
        builder.ToTable("TicketCustomStatuses");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Key).HasMaxLength(80).IsRequired();
        builder.Property(s => s.Name).HasMaxLength(80).IsRequired();
        builder.Property(s => s.ColorVariant).HasMaxLength(30).IsRequired();
        builder.Property(s => s.IconKey).HasMaxLength(50).IsRequired();
        builder.HasIndex(s => s.Key).IsUnique();
    }
}
