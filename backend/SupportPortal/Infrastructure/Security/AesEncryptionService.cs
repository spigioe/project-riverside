using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using SupportPortal.Application.DTOs.Encryption;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Infrastructure.Security;

// AES-256-GCM: a nonce (12 bájt) + tag (16 bájt) + ciphertext egyetlen base64 blobba csomagolva,
// hogy az IntegrationSetting.Config egyetlen string oszlopban tárolható legyen.
public class AesEncryptionService(IOptions<EncryptionSettings> options) : IEncryptionService
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private readonly byte[] _key = Convert.FromBase64String(options.Value.Key);

    public string Encrypt(string plaintext)
    {
        var plainBytes = System.Text.Encoding.UTF8.GetBytes(plaintext);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var ciphertext = new byte[plainBytes.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(_key, TagSize);
        aes.Encrypt(nonce, plainBytes, ciphertext, tag);

        var result = new byte[NonceSize + TagSize + ciphertext.Length];
        Buffer.BlockCopy(nonce, 0, result, 0, NonceSize);
        Buffer.BlockCopy(tag, 0, result, NonceSize, TagSize);
        Buffer.BlockCopy(ciphertext, 0, result, NonceSize + TagSize, ciphertext.Length);

        return Convert.ToBase64String(result);
    }

    public string Decrypt(string ciphertext)
    {
        var data = Convert.FromBase64String(ciphertext);

        var nonce = data.AsSpan(0, NonceSize);
        var tag = data.AsSpan(NonceSize, TagSize);
        var cipherBytes = data.AsSpan(NonceSize + TagSize);

        var plainBytes = new byte[cipherBytes.Length];

        using var aes = new AesGcm(_key, TagSize);
        aes.Decrypt(nonce, cipherBytes, tag, plainBytes);

        return System.Text.Encoding.UTF8.GetString(plainBytes);
    }
}
