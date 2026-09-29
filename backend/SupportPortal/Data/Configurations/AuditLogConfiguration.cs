using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Data.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        // Tevékenységnapló (jegyenként) és minőségi mutatók (újranyitás) EntityId alapján keresnek.
        builder.HasIndex(l => l.EntityId);
    }
}
