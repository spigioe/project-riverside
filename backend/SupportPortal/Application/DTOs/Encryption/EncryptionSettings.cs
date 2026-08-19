namespace SupportPortal.Application.DTOs.Encryption;

public class EncryptionSettings
{
    /// <summary>Base64 kódolt, 32 bájt hosszú (AES-256) kulcs.</summary>
    public string Key { get; set; } = null!;
}
