using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.UserPreferences;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public class UserPreferenceService(AppDbContext db) : IUserPreferenceService
{
    public async Task<UserPreferenceDto> GetAsync(int userId)
    {
        var pref = await db.UserPreferences.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId);
        return pref is null
            ? new UserPreferenceDto(true, TicketListView.Table, TicketDetailView.Classic, false)
            : new UserPreferenceDto(pref.TicketPropertiesAutosave, pref.TicketListView, pref.TicketDetailView, pref.TicketDetailSplitReversed);
    }

    public async Task<UserPreferenceDto> UpdateAsync(int userId, UpdateUserPreferenceRequest request)
    {
        var pref = await db.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId);
        if (pref is null)
        {
            pref = new UserPreference { UserId = userId };
            db.UserPreferences.Add(pref);
        }

        pref.TicketPropertiesAutosave = request.TicketPropertiesAutosave;
        pref.TicketListView = request.TicketListView;
        pref.TicketDetailView = request.TicketDetailView;
        pref.TicketDetailSplitReversed = request.TicketDetailSplitReversed;

        await db.SaveChangesAsync();
        return new UserPreferenceDto(pref.TicketPropertiesAutosave, pref.TicketListView, pref.TicketDetailView, pref.TicketDetailSplitReversed);
    }
}
