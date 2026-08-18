namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class CustomFieldDefinition
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string FieldKey { get; set; } = null!;
    public CustomFieldType FieldType { get; set; }
    public bool IsRequired { get; set; } = false;
    public string? Options { get; set; }  // JSON
    public string AppliesTo { get; set; } = "ticket";
    public int DisplayOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public int CreatedById { get; set; }
    public User CreatedBy { get; set; } = null!;

    public ICollection<CustomFieldValue> Values { get; set; } = [];
}
