using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using SupportPortal.Application.DTOs.CustomFields;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

// Az entitás EntityType/EntityId párost használ (jelenleg mindig "ticket" + Tickets.Id) — ez a
// tervezett polimorf kapcsolat, EZT használjuk lookup kulcsként. A CustomFieldValue.Ticket nav
// property egy a kezdeti migrációból megmaradt, ehhez nem kapcsolódó shadow FK-t (TicketId oszlop)
// takar — azt szándékosan nem használjuk/nem állítjuk, mert az EntityType/EntityId már megvan erre
// tervezve, és egy második, párhuzamos FK bevezetése/kitöltése külön migrációt és kockázatot jelentene
// olyasmiért, amit a jelenlegi séma már megold.
public class CustomFieldService(AppDbContext db) : ICustomFieldService
{
    private const string EntityType = "ticket";

    public async Task<IReadOnlyList<CustomFieldDefinitionDto>> GetDefinitionsAsync()
    {
        var definitions = await db.CustomFieldDefinitions
            .AsNoTracking()
            .Where(d => d.IsActive)
            .OrderBy(d => d.DisplayOrder)
            .ToListAsync();

        return definitions.Select(MapToDto).ToList();
    }

    public async Task<(CreateCustomFieldDefinitionResult Result, CustomFieldDefinitionDto? Field)> CreateDefinitionAsync(
        CreateCustomFieldDefinitionRequest request, int currentUserId)
    {
        string fieldKey;
        if (string.IsNullOrWhiteSpace(request.FieldKey))
        {
            fieldKey = await EnsureUniqueFieldKeyAsync(Slugify(request.Name));
        }
        else
        {
            fieldKey = request.FieldKey.Trim().ToLowerInvariant();
            var taken = await db.CustomFieldDefinitions.AnyAsync(d => d.FieldKey == fieldKey);
            if (taken) return (CreateCustomFieldDefinitionResult.FieldKeyTaken, null);
        }

        var field = new CustomFieldDefinition
        {
            Name = request.Name.Trim(),
            FieldKey = fieldKey,
            FieldType = request.FieldType,
            IsRequired = request.IsRequired,
            Options = SerializeOptions(request.FieldType, request.Options),
            AppliesTo = EntityType,
            DisplayOrder = request.DisplayOrder,
            IsActive = true,
            CreatedById = currentUserId,
        };

        db.CustomFieldDefinitions.Add(field);
        await db.SaveChangesAsync();

        return (CreateCustomFieldDefinitionResult.Success, MapToDto(field));
    }

    public async Task<UpdateCustomFieldDefinitionResult> UpdateDefinitionAsync(int id, UpdateCustomFieldDefinitionRequest request)
    {
        var field = await db.CustomFieldDefinitions.FirstOrDefaultAsync(d => d.Id == id);
        if (field is null) return UpdateCustomFieldDefinitionResult.NotFound;

        field.Name = request.Name.Trim();
        field.FieldType = request.FieldType;
        field.IsRequired = request.IsRequired;
        field.Options = SerializeOptions(request.FieldType, request.Options);
        field.DisplayOrder = request.DisplayOrder;

        await db.SaveChangesAsync();
        return UpdateCustomFieldDefinitionResult.Success;
    }

    public async Task<bool> DeactivateDefinitionAsync(int id)
    {
        var field = await db.CustomFieldDefinitions.FirstOrDefaultAsync(d => d.Id == id);
        if (field is null) return false;

        field.IsActive = false;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<IReadOnlyList<CustomFieldValueDto>?> GetValuesAsync(int ticketId)
    {
        var ticketExists = await db.Tickets.AnyAsync(t => t.Id == ticketId);
        if (!ticketExists) return null;

        var definitions = await db.CustomFieldDefinitions
            .AsNoTracking()
            .Where(d => d.IsActive)
            .OrderBy(d => d.DisplayOrder)
            .ToListAsync();

        var values = await db.CustomFieldValues
            .AsNoTracking()
            .Where(v => v.EntityType == EntityType && v.EntityId == ticketId)
            .ToListAsync();
        var valueByDefinitionId = values.ToDictionary(v => v.FieldDefinitionId, v => v.Value);

        return definitions
            .Select(d => new CustomFieldValueDto(
                d.Id, d.FieldKey, d.Name, d.FieldType,
                valueByDefinitionId.TryGetValue(d.Id, out var v) ? v : null,
                DeserializeOptions(d.Options)))
            .ToList();
    }

    public async Task<CustomFieldValuesUpdateResult> UpdateValuesAsync(int ticketId, IReadOnlyList<UpdateCustomFieldValueItem> items)
    {
        var ticketExists = await db.Tickets.AnyAsync(t => t.Id == ticketId);
        if (!ticketExists) return CustomFieldValuesUpdateResult.TicketNotFound;

        var definitionIds = items.Select(i => i.DefinitionId).Distinct().ToList();
        var definitions = await db.CustomFieldDefinitions
            .Where(d => definitionIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id);

        foreach (var item in items)
        {
            if (!definitions.TryGetValue(item.DefinitionId, out var definition))
                return CustomFieldValuesUpdateResult.DefinitionNotFound;

            if (definition.FieldType == CustomFieldType.Select && !string.IsNullOrEmpty(item.Value))
            {
                var options = DeserializeOptions(definition.Options) ?? [];
                if (!options.Contains(item.Value))
                    return CustomFieldValuesUpdateResult.InvalidOptionValue;
            }
        }

        var existing = await db.CustomFieldValues
            .Where(v => v.EntityType == EntityType && v.EntityId == ticketId && definitionIds.Contains(v.FieldDefinitionId))
            .ToListAsync();
        var existingByDefinitionId = existing.ToDictionary(v => v.FieldDefinitionId);

        foreach (var item in items)
        {
            if (string.IsNullOrEmpty(item.Value))
            {
                if (existingByDefinitionId.TryGetValue(item.DefinitionId, out var toRemove))
                    db.CustomFieldValues.Remove(toRemove);
                continue;
            }

            if (existingByDefinitionId.TryGetValue(item.DefinitionId, out var toUpdate))
            {
                toUpdate.Value = item.Value;
            }
            else
            {
                db.CustomFieldValues.Add(new CustomFieldValue
                {
                    FieldDefinitionId = item.DefinitionId,
                    EntityType = EntityType,
                    EntityId = ticketId,
                    Value = item.Value,
                });
            }
        }

        await db.SaveChangesAsync();
        return CustomFieldValuesUpdateResult.Success;
    }

    private async Task<string> EnsureUniqueFieldKeyAsync(string baseKey)
    {
        var key = baseKey;
        var suffix = 2;
        while (await db.CustomFieldDefinitions.AnyAsync(d => d.FieldKey == key))
        {
            key = $"{baseKey}-{suffix}";
            suffix++;
        }
        return key;
    }

    private static string? SerializeOptions(CustomFieldType fieldType, IReadOnlyList<string>? options) =>
        fieldType == CustomFieldType.Select && options is { Count: > 0 }
            ? JsonSerializer.Serialize(options)
            : null;

    private static IReadOnlyList<string>? DeserializeOptions(string? options) =>
        string.IsNullOrEmpty(options) ? null : JsonSerializer.Deserialize<List<string>>(options);

    private static CustomFieldDefinitionDto MapToDto(CustomFieldDefinition d) =>
        new(d.Id, d.Name, d.FieldKey, d.FieldType, d.IsRequired, DeserializeOptions(d.Options), d.DisplayOrder, d.IsActive);

    private static string Slugify(string input)
    {
        var withoutDiacritics = RemoveDiacritics(input.Trim().ToLowerInvariant());
        var slug = Regex.Replace(withoutDiacritics, @"[^a-z0-9]+", "-").Trim('-');
        return string.IsNullOrEmpty(slug) ? "mezo" : slug;
    }

    private static string RemoveDiacritics(string text)
    {
        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}
