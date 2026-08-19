namespace SupportPortal.Application.DTOs.Csm;

public record CsmDto(int Id, string Name, string Email, IReadOnlyList<string> Domains, DateTime CreatedAt);

public record CreateCsmRequest(string Name, string Email, IReadOnlyList<string> Domains);

public record UpdateCsmRequest(string Name, string Email, IReadOnlyList<string> Domains);

public record CsmSuggestionDto(int? CsmId, string? CsmName, string? CsmEmail);
