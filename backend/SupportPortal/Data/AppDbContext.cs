using Microsoft.EntityFrameworkCore;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<TicketCategory> TicketCategories => Set<TicketCategory>();
    public DbSet<TicketMessage> TicketMessages => Set<TicketMessage>();
    public DbSet<FileStorage> FileStorages => Set<FileStorage>();
    public DbSet<SlaPolicy> SlaPolicies => Set<SlaPolicy>();
    public DbSet<SlaPolicyPriority> SlaPolicyPriorities => Set<SlaPolicyPriority>();
    public DbSet<SlaPolicyCompany> SlaPolicyCompanies => Set<SlaPolicyCompany>();
    public DbSet<BusinessHours> BusinessHours => Set<BusinessHours>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();
    public DbSet<AiInteraction> AiInteractions => Set<AiInteraction>();
    public DbSet<CustomFieldDefinition> CustomFieldDefinitions => Set<CustomFieldDefinition>();
    public DbSet<CustomFieldValue> CustomFieldValues => Set<CustomFieldValue>();
    public DbSet<CannedResponseFolder> CannedResponseFolders => Set<CannedResponseFolder>();
    public DbSet<CannedResponse> CannedResponses => Set<CannedResponse>();
    public DbSet<ClickUpLink> ClickUpLinks => Set<ClickUpLink>();
    public DbSet<IntegrationSetting> IntegrationSettings => Set<IntegrationSetting>();
    public DbSet<ClickUpSyncLog> ClickUpSyncLogs => Set<ClickUpSyncLog>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<EmailQueue> EmailQueues => Set<EmailQueue>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<CsmManager> CsmManagers => Set<CsmManager>();
    public DbSet<CsmDomain> CsmDomains => Set<CsmDomain>();
    public DbSet<DashboardWidget> DashboardWidgets => Set<DashboardWidget>();
    public DbSet<UserPreference> UserPreferences => Set<UserPreference>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Contact> Contacts => Set<Contact>();
    public DbSet<TicketCustomStatus> TicketCustomStatuses => Set<TicketCustomStatus>();
    public DbSet<TicketType> TicketTypes => Set<TicketType>();
    public DbSet<SlaFreezeStatus> SlaFreezeStatuses => Set<SlaFreezeStatus>();
    public DbSet<AutoResponderTemplate> AutoResponderTemplates => Set<AutoResponderTemplate>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
