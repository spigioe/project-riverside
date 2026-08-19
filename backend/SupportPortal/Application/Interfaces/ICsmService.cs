using SupportPortal.Application.DTOs.Csm;

namespace SupportPortal.Application.Interfaces;

public enum CreateCsmResult { Success, EmailTaken }

public enum UpdateCsmResult { Success, NotFound, EmailTaken }

public enum DeleteCsmResult { Success, NotFound, HasActiveTickets }

public interface ICsmService
{
    Task<IReadOnlyList<CsmDto>> GetAllAsync();
    Task<(CreateCsmResult Result, CsmDto? Csm)> CreateAsync(CreateCsmRequest request);
    Task<UpdateCsmResult> UpdateAsync(int id, UpdateCsmRequest request);
    Task<DeleteCsmResult> DeleteAsync(int id);
    Task<CsmSuggestionDto> SuggestAsync(string requesterEmail);

    // Belső segédmetódus: a requester email domainje alapján megkeresi a hozzárendelendő CSM-et.
    // Automatikus hozzárendeléshez használja a TicketService (ticket létrehozáskor) és a
    // TicketEmailProcessor (bejövő email → új ticket). Ha több CSM is felelős ugyanarra a domainre,
    // az első (legkisebb Id-jú) találat kerül visszaadásra.
    Task<int?> FindCsmIdForEmailAsync(string requesterEmail);
}
