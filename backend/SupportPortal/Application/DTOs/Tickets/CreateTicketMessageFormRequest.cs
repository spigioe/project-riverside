using Microsoft.AspNetCore.Http;

namespace SupportPortal.Application.DTOs.Tickets;

// A POST /tickets/{id}/messages multipart/form-data-ként fogadja ezt (fájl csatolmányok miatt) —
// osztály (nem record), mert a [FromForm] modellkötés IFormFile-listát tartalmazó típusoknál
// settable property-ket vár, nem konstruktor-kötést.
public class CreateTicketMessageFormRequest
{
    public string Body { get; set; } = null!;
    public bool IsInternalNote { get; set; }
    public string? Cc { get; set; }
    public string? Bcc { get; set; }
    public List<IFormFile>? Attachments { get; set; }
}
