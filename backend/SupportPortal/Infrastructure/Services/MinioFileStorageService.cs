using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;
using SupportPortal.Application.DTOs;
using SupportPortal.Application.Interfaces;

namespace SupportPortal.Infrastructure.Services;

public class MinioFileStorageService(IMinioClient minioClient, IOptions<MinioSettings> options) : IFileStorageService
{
    private readonly MinioSettings _settings = options.Value;

    public async Task EnsureBucketExistsAsync()
    {
        var exists = await minioClient.BucketExistsAsync(new BucketExistsArgs().WithBucket(_settings.Bucket));
        if (!exists)
            await minioClient.MakeBucketAsync(new MakeBucketArgs().WithBucket(_settings.Bucket));
    }

    public async Task UploadAsync(string objectKey, Stream content, long size, string contentType)
    {
        await minioClient.PutObjectAsync(new PutObjectArgs()
            .WithBucket(_settings.Bucket)
            .WithObject(objectKey)
            .WithStreamData(content)
            .WithObjectSize(size)
            .WithContentType(string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType));
    }

    public async Task<Stream> DownloadAsync(string objectKey)
    {
        var memoryStream = new MemoryStream();
        await minioClient.GetObjectAsync(new GetObjectArgs()
            .WithBucket(_settings.Bucket)
            .WithObject(objectKey)
            .WithCallbackStream(stream => stream.CopyTo(memoryStream)));
        memoryStream.Position = 0;
        return memoryStream;
    }
}
