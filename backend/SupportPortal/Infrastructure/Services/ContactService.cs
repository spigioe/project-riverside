using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.Common;
using SupportPortal.Application.DTOs.Contacts;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;

namespace SupportPortal.Infrastructure.Services;

public class ContactService(AppDbContext db, ICompanyService companyService) : IContactService
{
    public async Task<PagedResult<ContactDto>> GetContactsAsync(ContactListQuery query)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 100 ? 25 : query.PageSize;

        var q = db.Contacts.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim();
            q = q.Where(c => c.Email.Contains(s) || c.Name.Contains(s));
        }

        if (query.CompanyId.HasValue)
            q = q.Where(c => c.CompanyId == query.CompanyId.Value);

        var total = await q.CountAsync();

        var contacts = await q
            .OrderBy(c => c.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(c => c.Company)
            .ToListAsync();

        var items = contacts.Select(MapToDto).ToList();
        return new PagedResult<ContactDto>(items, page, pageSize, total);
    }

    public async Task<ContactDetailDto?> GetByIdAsync(int id)
    {
        var contact = await db.Contacts
            .AsNoTracking()
            .Include(c => c.Company)
            .Include(c => c.Tickets)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contact is null) return null;

        var recentTickets = contact.Tickets
            .OrderByDescending(t => t.CreatedAt)
            .Take(10)
            .Select(t => new TicketSummaryDto(t.Id, t.Subject, t.Status.ToString(), t.CreatedAt))
            .ToList();

        return new ContactDetailDto(
            contact.Id, contact.Email, contact.Name,
            contact.CompanyId, contact.Company?.Name,
            contact.IsActive, contact.CreatedAt, contact.UpdatedAt,
            recentTickets);
    }

    public async Task<(ContactSaveResult Result, ContactDto? Contact)> CreateAsync(CreateContactRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        if (await db.Contacts.AnyAsync(c => c.Email == normalizedEmail))
            return (ContactSaveResult.EmailTaken, null);

        if (request.CompanyId.HasValue && !await db.Companies.AnyAsync(c => c.Id == request.CompanyId.Value))
            return (ContactSaveResult.CompanyNotFound, null);

        var companyId = request.CompanyId
            ?? await companyService.FindCompanyIdForEmailDomainAsync(normalizedEmail);

        var contact = new Contact
        {
            Email = normalizedEmail,
            Name = request.Name.Trim(),
            CompanyId = companyId,
        };
        db.Contacts.Add(contact);
        await db.SaveChangesAsync();

        await db.Entry(contact).Reference(c => c.Company).LoadAsync();
        return (ContactSaveResult.Success, MapToDto(contact));
    }

    public async Task<ContactSaveResult> UpdateAsync(int id, UpdateContactRequest request)
    {
        var contact = await db.Contacts.Include(c => c.Company).FirstOrDefaultAsync(c => c.Id == id);
        if (contact is null) return ContactSaveResult.EmailTaken; // NotFound handled at controller

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        if (await db.Contacts.AnyAsync(c => c.Id != id && c.Email == normalizedEmail))
            return ContactSaveResult.EmailTaken;

        if (request.CompanyId.HasValue && !await db.Companies.AnyAsync(c => c.Id == request.CompanyId.Value))
            return ContactSaveResult.CompanyNotFound;

        contact.Email = normalizedEmail;
        contact.Name = request.Name.Trim();
        contact.CompanyId = request.CompanyId;
        contact.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return ContactSaveResult.Success;
    }

    public async Task<ContactDeleteResult> DeleteAsync(int id)
    {
        var contact = await db.Contacts.FirstOrDefaultAsync(c => c.Id == id);
        if (contact is null) return ContactDeleteResult.NotFound;

        var hasTickets = await db.Tickets.AnyAsync(t => t.ContactId == id);
        if (hasTickets)
        {
            contact.IsActive = false;
            contact.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return ContactDeleteResult.Deactivated;
        }

        db.Contacts.Remove(contact);
        await db.SaveChangesAsync();
        return ContactDeleteResult.Success;
    }

    public async Task<ContactDto> UpsertAsync(string email, string name)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var normalizedName = name.Trim();

        var existing = await db.Contacts
            .Include(c => c.Company)
            .FirstOrDefaultAsync(c => c.Email == normalizedEmail);

        if (existing is not null)
            return MapToDto(existing);

        var companyId = await companyService.FindCompanyIdForEmailDomainAsync(normalizedEmail);

        var contact = new Contact
        {
            Email = normalizedEmail,
            Name = string.IsNullOrWhiteSpace(normalizedName) ? normalizedEmail : normalizedName,
            CompanyId = companyId,
        };
        db.Contacts.Add(contact);
        await db.SaveChangesAsync();

        if (companyId.HasValue)
            await db.Entry(contact).Reference(c => c.Company).LoadAsync();

        return MapToDto(contact);
    }

    public async Task<BuildFromTicketsResult> BuildContactsFromTicketsAsync()
    {
        var tickets = await db.Tickets
            .Where(t => !string.IsNullOrEmpty(t.RequesterEmail))
            .Select(t => new { t.Id, t.RequesterEmail, t.RequesterName, t.ContactId })
            .ToListAsync();

        int contactsCreated = 0;
        int contactsLinked = 0;
        int ticketsUpdated = 0;

        // Preload all existing contacts to minimise round trips
        var existingEmails = await db.Contacts
            .Select(c => new { c.Id, c.Email })
            .ToDictionaryAsync(c => c.Email, c => c.Id);

        foreach (var ticket in tickets)
        {
            var email = ticket.RequesterEmail!.Trim().ToLowerInvariant();
            var name = string.IsNullOrWhiteSpace(ticket.RequesterName) ? email : ticket.RequesterName.Trim();

            int contactId;
            if (existingEmails.TryGetValue(email, out var existingId))
            {
                contactId = existingId;
                contactsLinked++;
            }
            else
            {
                var companyId = await companyService.FindCompanyIdForEmailDomainAsync(email);
                var contact = new Contact { Email = email, Name = name, CompanyId = companyId };
                db.Contacts.Add(contact);
                await db.SaveChangesAsync();
                contactId = contact.Id;
                existingEmails[email] = contactId;
                contactsCreated++;
            }

            if (ticket.ContactId != contactId)
            {
                await db.Tickets
                    .Where(t => t.Id == ticket.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.ContactId, contactId));
                ticketsUpdated++;
            }
        }

        return new BuildFromTicketsResult(contactsCreated, contactsLinked, ticketsUpdated);
    }

    private static ContactDto MapToDto(Contact c) =>
        new(c.Id, c.Email, c.Name, c.CompanyId, c.Company?.Name, c.IsActive, c.CreatedAt, c.UpdatedAt);
}
