namespace SupportPortal.Application.DTOs;

public class MinioSettings
{
    public string Endpoint { get; set; } = "localhost:9000";
    public string AccessKey { get; set; } = null!;
    public string SecretKey { get; set; } = null!;
    public string Bucket { get; set; } = null!;
    public bool UseSSL { get; set; } = false;
}
