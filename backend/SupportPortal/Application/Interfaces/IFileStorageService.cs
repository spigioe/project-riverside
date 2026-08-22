namespace SupportPortal.Application.Interfaces;

public interface IFileStorageService
{
    Task EnsureBucketExistsAsync();
    Task UploadAsync(string objectKey, Stream content, long size, string contentType);
    Task<Stream> DownloadAsync(string objectKey);
}
