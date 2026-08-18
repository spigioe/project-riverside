using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Data.Configurations;

public class EmailQueueConfiguration : IEntityTypeConfiguration<EmailQueue>
{
    public void Configure(EntityTypeBuilder<EmailQueue> builder)
    {
        builder.HasIndex(e => e.ExternalMessageId).IsUnique();
        builder.Property(e => e.Status).HasConversion<string>();
    }
}
