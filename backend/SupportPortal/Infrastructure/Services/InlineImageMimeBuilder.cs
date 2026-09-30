using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using MimeKit;
using MimeKit.Utils;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Infrastructure.Services;

/// <summary>
/// A kimenő HTML-ben lévő /api/portal/attachments/{id}/download mintájú img src-eket CID-re cseréli
/// és multipart/related-be csomagolja. A képeket közvetlenül a tárolóból (IAttachmentService) olvassa —
/// nem HTTP-n át, mert a download végpont JWT-t igényel, amit egy háttérfolyamat nem tud küldeni.
/// </summary>
internal static class InlineImageMimeBuilder
{
    public static async Task<MimeEntity> BuildAsync(string html, IAttachmentService attachmentService, ILogger logger)
    {
        var matches = Regex.Matches(html, @"/api/portal/attachments/(\d+)/download");
        if (matches.Count == 0)
            return new TextPart("html") { Text = html };

        var builder = new BodyBuilder();
        var resolvedHtml = html;

        foreach (var match in matches.Cast<Match>().DistinctBy(m => m.Value))
        {
            if (!int.TryParse(match.Groups[1].Value, out var fileId)) continue;

            try
            {
                var download = await attachmentService.GetDownloadAsync(fileId);
                if (download is null)
                {
                    logger.LogWarning("Inline kép nem található: {Url}", match.Value);
                    continue;
                }

                var (stream, contentType, _) = download.Value;
                await using (stream)
                {
                    var cid = MimeUtils.GenerateMessageId();
                    var image = builder.LinkedResources.Add(cid, stream, ContentType.Parse(contentType));
                    image.ContentId = cid;
                    resolvedHtml = resolvedHtml.Replace(match.Value, $"cid:{cid}");
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Inline kép betöltése sikertelen: {Url}", match.Value);
            }
        }

        builder.HtmlBody = resolvedHtml;
        return builder.ToMessageBody();
    }
}
