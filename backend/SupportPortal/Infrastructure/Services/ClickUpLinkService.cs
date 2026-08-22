using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SupportPortal.Application.DTOs.Tickets;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

public class ClickUpLinkService(
    AppDbContext db,
    HttpClient httpClient,
    IIntegrationService integrationService,
    IAuditLogService auditLogService,
    ILogger<ClickUpLinkService> logger) : IClickUpLinkService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private record ClickUpTaskResponse(string? Id, string? Name, ClickUpTaskStatus? Status, string? Url);
    private record ClickUpTaskStatus(string? Status);

    public async Task<IReadOnlyList<ClickUpLinkDto>?> GetLinksAsync(int ticketId)
    {
        var ticketExists = await db.Tickets.AnyAsync(t => t.Id == ticketId);
        if (!ticketExists) return null;

        return await db.ClickUpLinks
            .AsNoTracking()
            .Where(l => l.TicketId == ticketId)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new ClickUpLinkDto(
                l.Id, l.TicketId, l.ClickUpTaskId, l.ClickUpTaskUrl, l.ClickUpTaskTitle,
                l.ClickUpStatus, l.StatusSyncedAt, l.Notes,
                l.CreatedById, l.CreatedBy != null ? l.CreatedBy.FullName : null, l.CreatedAt))
            .ToListAsync();
    }

    public async Task<ClickUpLinkDto?> AddLinkAsync(int ticketId, CreateClickUpLinkRequest request, int currentUserId)
    {
        var ticketExists = await db.Tickets.AnyAsync(t => t.Id == ticketId);
        if (!ticketExists) return null;

        var link = new ClickUpLink
        {
            TicketId = ticketId,
            ClickUpTaskId = request.ClickUpTaskId,
            ClickUpTaskUrl = request.ClickUpTaskUrl,
            ClickUpTaskTitle = request.ClickUpTaskTitle,
            Notes = request.Notes,
            CreatedById = currentUserId,
        };

        db.ClickUpLinks.Add(link);
        await db.SaveChangesAsync();

        await auditLogService.LogAsync(
            currentUserId, "ticket", ticketId, "clickup_link_added", null, link.ClickUpTaskTitle ?? link.ClickUpTaskId);

        return await db.ClickUpLinks
            .AsNoTracking()
            .Where(l => l.Id == link.Id)
            .Select(l => new ClickUpLinkDto(
                l.Id, l.TicketId, l.ClickUpTaskId, l.ClickUpTaskUrl, l.ClickUpTaskTitle,
                l.ClickUpStatus, l.StatusSyncedAt, l.Notes,
                l.CreatedById, l.CreatedBy != null ? l.CreatedBy.FullName : null, l.CreatedAt))
            .FirstAsync();
    }

    public async Task<bool> DeleteLinkAsync(int ticketId, int linkId, int currentUserId)
    {
        var link = await db.ClickUpLinks.FirstOrDefaultAsync(l => l.Id == linkId && l.TicketId == ticketId);
        if (link is null) return false;

        db.ClickUpLinks.Remove(link);
        await db.SaveChangesAsync();

        await auditLogService.LogAsync(
            currentUserId, "ticket", ticketId, "clickup_link_removed", link.ClickUpTaskTitle ?? link.ClickUpTaskId, null);

        return true;
    }

    public async Task<ClickUpLinkDto?> SyncLinkAsync(int ticketId, int linkId, ClickUpSyncTrigger trigger)
    {
        var link = await db.ClickUpLinks
            .Include(l => l.CreatedBy)
            .FirstOrDefaultAsync(l => l.Id == linkId && l.TicketId == ticketId);
        if (link is null) return null;

        var apiKey = await integrationService.GetDecryptedApiKeyAsync();
        if (apiKey is null)
        {
            logger.LogInformation("ClickUp API kulcs nincs beállítva, szinkron kihagyva (ticket #{TicketId}).", ticketId);
            await LogSyncAsync(trigger, ticketId, linksChecked: 0, linksUpdated: 0, "ClickUp API kulcs nincs beállítva.");
            return MapToDto(link);
        }

        var updated = await FetchAndApplyStatusAsync(link, apiKey);
        await db.SaveChangesAsync();
        await LogSyncAsync(trigger, ticketId, linksChecked: 1, linksUpdated: updated ? 1 : 0, errorMessage: null);

        return MapToDto(link);
    }

    public async Task SyncTicketLinksAsync(int ticketId, ClickUpSyncTrigger trigger)
    {
        var links = await db.ClickUpLinks.Where(l => l.TicketId == ticketId).ToListAsync();
        if (links.Count == 0) return;

        var apiKey = await integrationService.GetDecryptedApiKeyAsync();
        if (apiKey is null)
        {
            logger.LogInformation("ClickUp API kulcs nincs beállítva, szinkron kihagyva (ticket #{TicketId}).", ticketId);
            await LogSyncAsync(trigger, ticketId, linksChecked: 0, linksUpdated: 0, "ClickUp API kulcs nincs beállítva.");
            return;
        }

        var updatedCount = 0;
        foreach (var link in links)
        {
            if (await FetchAndApplyStatusAsync(link, apiKey)) updatedCount++;
        }

        await db.SaveChangesAsync();
        await LogSyncAsync(trigger, ticketId, linksChecked: links.Count, linksUpdated: updatedCount, errorMessage: null);
    }

    public async Task SyncAllActiveLinksAsync(ClickUpSyncTrigger trigger)
    {
        var apiKey = await integrationService.GetDecryptedApiKeyAsync();
        if (apiKey is null)
        {
            logger.LogInformation("ClickUp API kulcs nincs beállítva, ütemezett szinkron kihagyva.");
            await LogSyncAsync(trigger, ticketId: null, linksChecked: 0, linksUpdated: 0, "ClickUp API kulcs nincs beállítva.");
            return;
        }

        var links = await db.ClickUpLinks.ToListAsync();
        var updatedCount = 0;
        foreach (var link in links)
        {
            if (await FetchAndApplyStatusAsync(link, apiKey)) updatedCount++;
        }

        await db.SaveChangesAsync();
        await LogSyncAsync(trigger, ticketId: null, linksChecked: links.Count, linksUpdated: updatedCount, errorMessage: null);
    }

    private async Task<bool> FetchAndApplyStatusAsync(ClickUpLink link, string apiKey)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"task/{link.ClickUpTaskId}");
            request.Headers.TryAddWithoutValidation("Authorization", apiKey);

            var response = await httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "ClickUp task lekérdezés sikertelen ({StatusCode}) a(z) {TaskId} taskra.",
                    response.StatusCode, link.ClickUpTaskId);
                return false;
            }

            var task = await response.Content.ReadFromJsonAsync<ClickUpTaskResponse>(JsonOptions);
            if (task is null) return false;

            link.ClickUpStatus = task.Status?.Status;
            if (!string.IsNullOrWhiteSpace(task.Name)) link.ClickUpTaskTitle = task.Name;
            link.StatusSyncedAt = DateTime.UtcNow;
            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ClickUp szinkron hiba a(z) {TaskId} taskra.", link.ClickUpTaskId);
            return false;
        }
    }

    private async Task LogSyncAsync(ClickUpSyncTrigger trigger, int? ticketId, int linksChecked, int linksUpdated, string? errorMessage)
    {
        db.ClickUpSyncLogs.Add(new ClickUpSyncLog
        {
            TriggeredBy = trigger,
            TicketId = ticketId,
            LinksChecked = linksChecked,
            LinksUpdated = linksUpdated,
            ErrorMessage = errorMessage,
        });
        await db.SaveChangesAsync();
    }

    private static ClickUpLinkDto MapToDto(ClickUpLink l) => new(
        l.Id, l.TicketId, l.ClickUpTaskId, l.ClickUpTaskUrl, l.ClickUpTaskTitle,
        l.ClickUpStatus, l.StatusSyncedAt, l.Notes,
        l.CreatedById, l.CreatedBy != null ? l.CreatedBy.FullName : null, l.CreatedAt);
}
