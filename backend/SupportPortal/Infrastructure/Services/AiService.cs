using System.Text;
using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Messages;
using AnthropicRole = Anthropic.Models.Messages.Role;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SupportPortal.Application.DTOs;
using SupportPortal.Application.DTOs.Ai;
using SupportPortal.Application.Interfaces;
using SupportPortal.Data;
using SupportPortal.Domain.Entities;
using SupportPortal.Domain.Enums;

namespace SupportPortal.Infrastructure.Services;

// AI funkciók (összefoglaló, válasz javaslat, kategorizálás) az Anthropic Messages API-n keresztül.
// Ha nincs API kulcs beállítva, vagy az API hívás bármilyen okból meghiúsul, graceful degradation:
// AiOperationStatus.Unavailable-t ad vissza, SOHA nem dob kivételt — a ticket funkcionalitás
// ettől függetlenül működik.
public class AiService(AppDbContext db, IOptions<AiSettings> aiOptions, ILogger<AiService> logger) : IAiService
{
    private const string ModelId = "claude-opus-5";
    private readonly AnthropicClient _client = new() { ApiKey = aiOptions.Value.ApiKey };

    public async Task<AiOperationResult<AiSummaryResponse>> SummarizeAsync(int ticketId, int currentUserId)
    {
        var ticket = await LoadTicketContextAsync(ticketId);
        if (ticket is null) return AiOperationResult<AiSummaryResponse>.NotFound();

        const string systemPrompt =
            "Te egy support portál AI asszisztense vagy. A feladatod, hogy magyar nyelven, tömören " +
            "(legfeljebb 3-4 mondatban) összefoglald egy support ticket lényegét egy ügyfélszolgálati " +
            "munkatárs számára, aki most nyitja meg először a jegyet. Csak az összefoglalót írd le, " +
            "bevezető vagy záró mondat nélkül.";

        var userPrompt = BuildTicketContext(ticket);
        var (text, tokensUsed, error) = await CallClaudeAsync(systemPrompt, userPrompt, maxTokens: 1024);
        if (error is not null) return AiOperationResult<AiSummaryResponse>.Unavailable(error);

        await LogInteractionAsync(ticketId, currentUserId, AiInteractionType.Summary, userPrompt, text!, tokensUsed);
        return AiOperationResult<AiSummaryResponse>.Ok(new AiSummaryResponse(text!));
    }

    public async Task<AiOperationResult<AiSuggestReplyResponse>> SuggestReplyAsync(int ticketId, int currentUserId)
    {
        var ticket = await LoadTicketContextAsync(ticketId);
        if (ticket is null) return AiOperationResult<AiSuggestReplyResponse>.NotFound();

        const string systemPrompt =
            "Te egy support portál AI asszisztense vagy. A feladatod, hogy a ticket eddigi beszélgetése " +
            "alapján magyar nyelven megfogalmazz egy udvarias, szakszerű válaszemailt a bejelentő számára. " +
            "Csak magát az emailszöveget írd le (megszólítással és aláírás nélküli zárómondattal), " +
            "ne adj hozzá magyarázatot vagy jegyzetet a válaszod elé/mögé.";

        var userPrompt = BuildTicketContext(ticket);
        var (text, tokensUsed, error) = await CallClaudeAsync(systemPrompt, userPrompt, maxTokens: 2048);
        if (error is not null) return AiOperationResult<AiSuggestReplyResponse>.Unavailable(error);

        await LogInteractionAsync(ticketId, currentUserId, AiInteractionType.Suggestion, userPrompt, text!, tokensUsed);
        return AiOperationResult<AiSuggestReplyResponse>.Ok(new AiSuggestReplyResponse(text!));
    }

    public async Task<AiOperationResult<AiClassifyResponse>> ClassifyAsync(int ticketId, int currentUserId)
    {
        var ticket = await LoadTicketContextAsync(ticketId);
        if (ticket is null) return AiOperationResult<AiClassifyResponse>.NotFound();

        var categories = await db.TicketCategories.AsNoTracking()
            .Select(c => new { c.Id, c.Name })
            .ToListAsync();

        var categoryList = categories.Count == 0
            ? "(nincs elérhető kategória)"
            : string.Join("\n", categories.Select(c => $"- id={c.Id}: {c.Name}"));

        var systemPrompt =
            "Te egy support portál AI asszisztense vagy. A feladatod, hogy a ticket tartalma alapján " +
            "javasolj egy kategóriát a megadott listából és egy prioritást. Válaszolj KIZÁRÓLAG egy " +
            "érvényes JSON objektummal, semmi mással (se magyarázat, se markdown code fence), pontosan " +
            "ilyen alakban: {\"categoryId\": <szám vagy null, ha egyik kategória sem illik>, " +
            "\"priority\": \"Low\"|\"Medium\"|\"High\"|\"Urgent\"}.\n\n" +
            $"Elérhető kategóriák:\n{categoryList}";

        var userPrompt = BuildTicketContext(ticket);
        var (text, tokensUsed, error) = await CallClaudeAsync(systemPrompt, userPrompt, maxTokens: 500);
        if (error is not null) return AiOperationResult<AiClassifyResponse>.Unavailable(error);

        var parsed = TryParseClassification(text!, categories.ToDictionary(c => c.Id, c => c.Name));
        if (parsed is null)
        {
            logger.LogWarning("Az AI kategorizálás válasza nem volt értelmezhető JSON: {Text}", text);
            return AiOperationResult<AiClassifyResponse>.Unavailable("Az AI válasza nem volt értelmezhető.");
        }

        await LogInteractionAsync(ticketId, currentUserId, AiInteractionType.Classification, userPrompt, text!, tokensUsed);
        return AiOperationResult<AiClassifyResponse>.Ok(parsed);
    }

    private async Task<(string? Text, int TokensUsed, string? Error)> CallClaudeAsync(string systemPrompt, string userPrompt, int maxTokens)
    {
        if (string.IsNullOrWhiteSpace(aiOptions.Value.ApiKey))
            return (null, 0, "Az AI szolgáltatás nincs beállítva (hiányzó API kulcs).");

        try
        {
            var response = await _client.Messages.Create(new MessageCreateParams
            {
                Model = ModelId,
                MaxTokens = maxTokens,
                System = systemPrompt,
                OutputConfig = new OutputConfig { Effort = Effort.Medium },
                Messages = [new() { Role = AnthropicRole.User, Content = userPrompt }],
            });

            var text = response.Content.Select(b => b.Value).OfType<TextBlock>().FirstOrDefault()?.Text;
            if (string.IsNullOrWhiteSpace(text))
                return (null, 0, "Az AI nem adott vissza értékelhető választ.");

            var tokensUsed = (int)(response.Usage.InputTokens + response.Usage.OutputTokens);
            return (text, tokensUsed, null);
        }
        catch (AnthropicApiException ex)
        {
            logger.LogWarning(ex, "Az AI szolgáltatás (Anthropic API) hívása sikertelen.");
            return (null, 0, "Az AI szolgáltatás jelenleg nem érhető el.");
        }
        catch (AnthropicIOException ex)
        {
            logger.LogWarning(ex, "Nem sikerült kapcsolódni az AI szolgáltatáshoz.");
            return (null, 0, "Nem sikerült kapcsolódni az AI szolgáltatáshoz.");
        }
    }

    private static AiClassifyResponse? TryParseClassification(string rawText, IReadOnlyDictionary<int, string> categoryNames)
    {
        var jsonText = ExtractJsonObject(rawText);
        if (jsonText is null) return null;

        try
        {
            using var doc = JsonDocument.Parse(jsonText);
            var root = doc.RootElement;

            int? categoryId = root.TryGetProperty("categoryId", out var categoryIdProp) && categoryIdProp.ValueKind == JsonValueKind.Number
                ? categoryIdProp.GetInt32()
                : null;

            var priorityText = root.TryGetProperty("priority", out var priorityProp) ? priorityProp.GetString() : null;
            if (!Enum.TryParse<TicketPriority>(priorityText, ignoreCase: true, out var priority))
                priority = TicketPriority.Medium;

            categoryNames.TryGetValue(categoryId ?? -1, out var categoryName);

            return new AiClassifyResponse(categoryId, categoryName, priority);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? ExtractJsonObject(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        return start >= 0 && end > start ? text[start..(end + 1)] : null;
    }

    private async Task LogInteractionAsync(int ticketId, int userId, AiInteractionType type, string prompt, string response, int tokensUsed)
    {
        db.AiInteractions.Add(new AiInteraction
        {
            TicketId = ticketId,
            UserId = userId,
            PromptSnapshot = prompt,
            ResponseSnapshot = response,
            ModelUsed = ModelId,
            TokensUsed = tokensUsed,
            InteractionType = type,
        });
        await db.SaveChangesAsync();
    }

    private async Task<TicketAiContext?> LoadTicketContextAsync(int ticketId)
    {
        var ticket = await db.Tickets
            .AsNoTracking()
            .Where(t => t.Id == ticketId)
            .Select(t => new TicketAiContext(
                t.Id, t.Subject, t.Body, t.Status, t.Priority,
                t.Category != null ? t.Category.Name : null,
                t.RequesterName, t.RequesterEmail))
            .FirstOrDefaultAsync();

        if (ticket is null) return null;

        var messages = await db.TicketMessages
            .AsNoTracking()
            .Where(m => m.TicketId == ticketId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new TicketAiMessage(m.Direction, m.IsInternalNote, m.Body, m.CreatedAt))
            .ToListAsync();

        return ticket with { Messages = messages };
    }

    private static string BuildTicketContext(TicketAiContext ticket)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Ticket #{ticket.Id}: {ticket.Subject}");
        sb.AppendLine($"Állapot: {ticket.Status}, Prioritás: {ticket.Priority}, Kategória: {ticket.CategoryName ?? "nincs"}");
        sb.AppendLine($"Bejelentő: {ticket.RequesterName} <{ticket.RequesterEmail}>");
        sb.AppendLine();
        sb.AppendLine($"Eredeti leírás:\n{ticket.Body}");
        sb.AppendLine();

        if (ticket.Messages.Count == 0)
        {
            sb.AppendLine("(még nincs üzenetváltás a jegyben)");
        }
        else
        {
            sb.AppendLine("Üzenetváltás:");
            foreach (var m in ticket.Messages)
            {
                var author = m.Direction == MessageDirection.Inbound ? "Bejelentő" : "Ügyintéző";
                var noteTag = m.IsInternalNote ? " [belső megjegyzés]" : "";
                sb.AppendLine($"[{author}{noteTag}, {m.CreatedAt:yyyy-MM-dd HH:mm}]: {m.Body}");
            }
        }

        return sb.ToString();
    }

    private record TicketAiContext(
        int Id, string Subject, string Body, TicketStatus Status, TicketPriority Priority,
        string? CategoryName, string RequesterName, string RequesterEmail)
    {
        public IReadOnlyList<TicketAiMessage> Messages { get; init; } = [];
    }

    private record TicketAiMessage(MessageDirection Direction, bool IsInternalNote, string Body, DateTime CreatedAt);
}
