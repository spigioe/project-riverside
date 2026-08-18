namespace SupportPortal.Domain.Entities;

public class CustomFieldValue
{
    public int Id { get; set; }
    public int FieldDefinitionId { get; set; }
    public CustomFieldDefinition FieldDefinition { get; set; } = null!;
    public string EntityType { get; set; } = "ticket";
    public int EntityId { get; set; }
    public string Value { get; set; } = null!;
    public Ticket? Ticket { get; set; }
}
