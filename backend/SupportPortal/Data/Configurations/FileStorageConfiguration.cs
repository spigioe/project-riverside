using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Data.Configurations;

public class FileStorageConfiguration : IEntityTypeConfiguration<FileStorage>
{
    public void Configure(EntityTypeBuilder<FileStorage> builder)
    {
        builder.HasOne(f => f.Message)
            .WithMany()
            .HasForeignKey(f => f.MessageId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);

        builder.HasOne(f => f.Ticket)
            .WithMany()
            .HasForeignKey(f => f.TicketId)
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired(false);

        builder.Property(f => f.ContentId).HasMaxLength(512);
        builder.Property(f => f.OriginalFilename).HasMaxLength(512);
        builder.Property(f => f.MimeType).HasMaxLength(256);
        builder.Property(f => f.ObjectKey).HasMaxLength(1024);
        builder.Property(f => f.BucketOrPath).HasMaxLength(256);
    }
}
