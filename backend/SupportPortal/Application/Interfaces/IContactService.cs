using SupportPortal.Application.DTOs.Common;
using SupportPortal.Application.DTOs.Contacts;

namespace SupportPortal.Application.Interfaces;

public enum ContactDeleteResult { Success, NotFound, Deactivated }
public enum ContactSaveResult { Success, EmailTaken, CompanyNotFound }

public interface IContactService
{
    Task<PagedResult<ContactDto>> GetContactsAsync(ContactListQuery query);
    Task<ContactDetailDto?> GetByIdAsync(int id);
    Task<(ContactSaveResult Result, ContactDto? Contact)> CreateAsync(CreateContactRequest request);
    Task<ContactSaveResult> UpdateAsync(int id, UpdateContactRequest request);
    Task<ContactDeleteResult> DeleteAsync(int id);
    Task<ContactDto> UpsertAsync(string email, string name);
}
