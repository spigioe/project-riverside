using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Data.Configurations;

public class TicketMessageConfiguration : IEntityTypeConfiguration<TicketMessage>
{
    public void Configure(EntityTypeBuilder<TicketMessage> builder)
    {
        builder.HasOne(m => m.SourceTicket)
            .WithMany()
            .HasForeignKey(m => m.SourceTicketId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(m => m.RawEmailParts).HasColumnType("longtext");
    }
}
