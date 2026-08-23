using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Data.Configurations;

public class TicketConfiguration : IEntityTypeConfiguration<Ticket>
{
    public void Configure(EntityTypeBuilder<Ticket> builder)
    {
        builder.HasOne(t => t.AssignedTo)
            .WithMany(u => u.AssignedTickets)
            .HasForeignKey(t => t.AssignedToId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.CreatedBy)
            .WithMany(u => u.CreatedTickets)
            .HasForeignKey(t => t.CreatedById)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.MergedIntoTicket)
            .WithMany()
            .HasForeignKey(t => t.MergedIntoTicketId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.Csm)
            .WithMany(c => c.Tickets)
            .HasForeignKey(t => t.CsmId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.Contact)
            .WithMany(c => c.Tickets)
            .HasForeignKey(t => t.ContactId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(t => t.Status).HasConversion<string>();
        builder.Property(t => t.Priority).HasConversion<string>();
        builder.Property(t => t.Source).HasConversion<string>();
        builder.Property(t => t.Type).HasConversion<string>();
    }
}
