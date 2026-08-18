namespace SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

public class Role
{
    public int Id { get; set; }
    public UserRole Name { get; set; }
    public ICollection<User> Users { get; set; } = [];
}
