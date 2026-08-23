using Microsoft.EntityFrameworkCore;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        // A szerepkörök seedelése minden induláskor lefut (idempotens), függetlenül attól, hogy
        // a felhasználó- és ticket-seed már megtörtént-e — így a később hozzáadott UserRole
        // enum értékek (Admin, Viewer) is biztosan léteznek Role sorként.
        var existingRoleNames = await db.Roles.Select(r => r.Name).ToListAsync();
        foreach (var roleName in Enum.GetValues<UserRole>())
        {
            if (!existingRoleNames.Contains(roleName))
                db.Roles.Add(new Role { Name = roleName });
        }
        await db.SaveChangesAsync();

        if (await db.Users.AnyAsync()) return; // már seedelt

        var masterAdminRole = await db.Roles.FirstAsync(r => r.Name == UserRole.MasterAdmin);

        // Master admin user
        var admin = new User
        {
            Email = "admin@supportportal.dev",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin1234!"),
            FullName = "Master Admin",
            RoleId = masterAdminRole.Id,
            IsActive = true
        };
        db.Users.Add(admin);
        await db.SaveChangesAsync();

        // Kategóriák
        var categories = new[]
        {
            new TicketCategory { Name = "Általános" },
            new TicketCategory { Name = "Bug" },
            new TicketCategory { Name = "Feature Request" },
            new TicketCategory { Name = "ESG" },
        };
        db.TicketCategories.AddRange(categories);
        await db.SaveChangesAsync();

        // Teszt ticketek
        var tickets = new[]
        {
            new Ticket
            {
                Subject = "Nem tölt be a HOME modul",
                Body = "A HOME modul főoldala 502-es hibát dob bejelentkezés után.",
                Status = TicketStatus.Open,
                Priority = TicketPriority.High,
                CategoryId = categories[1].Id,
                AssignedToId = admin.Id,
                RequesterEmail = "teszt.felhasznalo@mol.hu",
                RequesterName = "Teszt Felhasználó",
                Source = TicketSource.Email,
            },
            new Ticket
            {
                Subject = "ESG kérdőív hozzáférés kérés",
                Body = "Szeretnék hozzáférést kapni az ESG kérdőív kitöltéséhez.",
                Status = TicketStatus.New,
                Priority = TicketPriority.Medium,
                CategoryId = categories[3].Id,
                RequesterEmail = "supplier@example.com",
                RequesterName = "Külső Szállító Kft.",
                Source = TicketSource.Email,
            },
            new Ticket
            {
                Subject = "WASTE modul importálás hibás",
                Body = "Az Excel importálás során a következő hiba jelenik meg: invalid column mapping.",
                Status = TicketStatus.Pending,
                Priority = TicketPriority.Medium,
                CategoryId = categories[1].Id,
                AssignedToId = admin.Id,
                RequesterEmail = "waste.manager@eon.hu",
                RequesterName = "Waste Manager",
                Source = TicketSource.Portal,
            },
            new Ticket
            {
                Subject = "Új riport típus igény — CSRD",
                Body = "Szükségünk lenne egy CSRD-specifikus riport sablonra a negyedéves záráshoz.",
                Status = TicketStatus.Open,
                Priority = TicketPriority.Low,
                CategoryId = categories[2].Id,
                RequesterEmail = "csrd.lead@bigcorp.hu",
                RequesterName = "CSRD Felelős",
                Source = TicketSource.Email,
            },
            new Ticket
            {
                Subject = "Bejelentkezési probléma — jelszó reset nem érkezik meg",
                Body = "A jelszó visszaállító email nem érkezik meg, spam mappát is ellenőriztem.",
                Status = TicketStatus.Resolved,
                Priority = TicketPriority.Urgent,
                CategoryId = categories[0].Id,
                AssignedToId = admin.Id,
                RequesterEmail = "user@chemical.hu",
                RequesterName = "Vegyész Felhasználó",
                Source = TicketSource.Email,
            },
        };
        db.Tickets.AddRange(tickets);
        await db.SaveChangesAsync();

        // SLA master policy + prioritás sorok
        var masterPolicy = new SlaPolicy { Name = "Master SLA", IsDefault = true, BusinessHoursOnly = true };
        db.SlaPolicies.Add(masterPolicy);
        await db.SaveChangesAsync();

        db.SlaPolicyPriorities.AddRange(
            new SlaPolicyPriority { SlaPolicyId = masterPolicy.Id, Priority = "Low",    ResponseTimeMinutes = 480,  ResolutionTimeMinutes = 4320 },
            new SlaPolicyPriority { SlaPolicyId = masterPolicy.Id, Priority = "Medium", ResponseTimeMinutes = 240,  ResolutionTimeMinutes = 1440 },
            new SlaPolicyPriority { SlaPolicyId = masterPolicy.Id, Priority = "High",   ResponseTimeMinutes = 120,  ResolutionTimeMinutes = 480  },
            new SlaPolicyPriority { SlaPolicyId = masterPolicy.Id, Priority = "Urgent", ResponseTimeMinutes = 30,   ResolutionTimeMinutes = 240  }
        );

        // Munkaidő (H-P, 8:00-17:00)
        var workDays = new[] { DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday };
        db.BusinessHours.AddRange(workDays.Select(d => new BusinessHours
        {
            DayOfWeek = d,
            StartTime = new TimeOnly(8, 0),
            EndTime = new TimeOnly(17, 0)
        }));

        await db.SaveChangesAsync();
    }
}
