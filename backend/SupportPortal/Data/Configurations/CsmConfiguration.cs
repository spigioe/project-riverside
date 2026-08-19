using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Data.Configurations;

public class CsmManagerConfiguration : IEntityTypeConfiguration<CsmManager>
{
    public void Configure(EntityTypeBuilder<CsmManager> builder)
    {
        builder.HasIndex(c => c.Email).IsUnique();
    }
}

public class CsmDomainConfiguration : IEntityTypeConfiguration<CsmDomain>
{
    public void Configure(EntityTypeBuilder<CsmDomain> builder)
    {
        builder.HasOne(d => d.Csm)
            .WithMany(c => c.Domains)
            .HasForeignKey(d => d.CsmId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
