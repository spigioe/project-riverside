using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Data.Configurations;

public class SlaPolicyCompanyConfiguration : IEntityTypeConfiguration<SlaPolicyCompany>
{
    public void Configure(EntityTypeBuilder<SlaPolicyCompany> builder)
    {
        builder.HasIndex(c => new { c.SlaPolicyId, c.CompanyId }).IsUnique();

        builder.HasOne(c => c.SlaPolicy)
            .WithMany(s => s.Companies)
            .HasForeignKey(c => c.SlaPolicyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Company)
            .WithMany()
            .HasForeignKey(c => c.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
