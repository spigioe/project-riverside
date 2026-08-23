using SupportPortal.Application.DTOs.Contacts;

namespace SupportPortal.Application.DTOs.Companies;

public record CompanyDto(
    int Id,
    string Name,
    string? Domain,
    int ContactCount,
    DateTime CreatedAt
);

public record CompanyDetailDto(
    int Id,
    string Name,
    string? Domain,
    DateTime CreatedAt,
    IReadOnlyList<ContactDto> Contacts
);

public record CompanyListQuery(
    string? Search = null,
    int Page = 1,
    int PageSize = 25
);

public record CreateCompanyRequest(string Name, string? Domain);

public record UpdateCompanyRequest(string Name, string? Domain);
