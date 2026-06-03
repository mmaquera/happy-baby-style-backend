import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { IStorageService } from '../../domain/interfaces/IStorageService';
import { IFileValidationService } from '../../domain/interfaces/IFileValidationService';
import { FileValidationService } from '../../application/validation/FileValidationService';
import {
  FileUploadError,
  FileDeleteError,
  FileValidationError,
  StorageConfigurationError,
} from '../../domain/errors/StorageError';
import { LoggerFactory, ILogger } from '@hbs/logging';

// ---------------------------------------------------------------------------
// Config shape — all values read from env; no defaults for credentials/bucket
// (fail-fast at construction, not at call time).
// ---------------------------------------------------------------------------
interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
}

function readS3Config(): S3Config {
  const required: Record<keyof S3Config, string> = {
    endpoint: process.env.S3_ENDPOINT ?? '',
    bucket: process.env.S3_BUCKET_NAME ?? '',
    region: process.env.S3_REGION ?? '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    publicUrl: process.env.S3_PUBLIC_URL ?? '',
  };

  const missing = (Object.entries(required) as [keyof S3Config, string][])
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new StorageConfigurationError(
      `S3StorageService: missing required environment variable(s): ${missing.join(', ')}`,
      { missing },
    );
  }

  return required as S3Config;
}

export class S3StorageService implements IStorageService {
  private readonly client: S3Client;
  private readonly config: S3Config;
  private readonly validationService: IFileValidationService;
  private readonly logger: ILogger;

  constructor(logger?: ILogger, validationService?: IFileValidationService) {
    this.config = readS3Config();
    this.validationService = validationService ?? new FileValidationService();
    this.logger = logger ?? LoggerFactory.getInstance().createServiceLogger('S3StorageService');

    this.client = new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      // forcePathStyle: required for MinIO and other S3-compatible services that use
      // path-style URLs (http://endpoint/bucket/key) instead of virtual-hosted-style
      // (http://bucket.endpoint/key). For AWS S3 itself this has no effect when the
      // endpoint is the default AWS endpoint.
      forcePathStyle: true,
    });

    this.logger.info('S3StorageService initialized', {
      endpoint: this.config.endpoint,
      bucket: this.config.bucket,
      region: this.config.region,
    });
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folder?: string,
  ): Promise<string> {
    try {
      this.validationService.validateFile(fileName, mimeType, buffer.length);

      const key = folder ? `${folder}/${fileName}` : fileName;

      // Use lib-storage Upload with a Readable stream — avoids loading the full
      // buffer into memory twice during the multipart PUT. For files below the
      // 5 MB threshold lib-storage performs a single PutObject; above that it
      // uses multipart upload automatically.
      const stream = Readable.from(buffer);

      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.config.bucket,
          Key: key,
          Body: stream,
          ContentType: mimeType,
        },
      });

      await upload.done();

      // Build the canonical public URL now and return it directly.
      // buildMediaUrl() in the resolver layer passes URLs that start with 'http'
      // through unchanged, so returning a full URL here is safe for both drivers.
      const publicUrl = this.getPublicUrl(fileName, folder);

      this.logger.info('File uploaded to S3', {
        key,
        publicUrl,
        bucket: this.config.bucket,
        fileSize: buffer.length,
        mimeType,
      });

      return publicUrl;
    } catch (error) {
      if (error instanceof FileValidationError) throw error;
      if (error instanceof FileUploadError) throw error;

      this.logger.error(
        'S3 upload failed',
        error instanceof Error ? error : new Error('Unknown error'),
        { fileName, mimeType },
      );
      throw new FileUploadError('Failed to upload file to S3', {
        fileName,
        mimeType,
        fileSize: buffer.length,
        originalError: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // fileUrl may be a full URL (http(s)://...) or a raw key path. Extract the
      // key: for full URLs strip everything up to and including the bucket prefix.
      const key = this.extractKeyFromUrl(fileUrl);

      if (!key) {
        this.logger.warn('deleteFile called with empty key — skipping', { fileUrl });
        return;
      }

      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );

      this.logger.info('File deleted from S3', { key, bucket: this.config.bucket });
    } catch (error) {
      if (error instanceof FileDeleteError) throw error;

      this.logger.error(
        'S3 delete failed',
        error instanceof Error ? error : new Error('Unknown error'),
        { fileUrl },
      );
      throw new FileDeleteError('Failed to delete file from S3', {
        fileUrl,
        originalError: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  getPublicUrl(fileName: string, folder?: string): string {
    const key = folder ? `${folder}/${fileName}` : fileName;
    return `${this.config.publicUrl}/${key}`;
  }

  validateFile(fileName: string, mimeType: string, fileSize: number): boolean {
    try {
      this.validationService.validateFile(fileName, mimeType, fileSize);
      return true;
    } catch {
      return false;
    }
  }

  getBucketName(): string {
    return this.config.bucket;
  }

  /**
   * R6 — Generate a presigned GET URL for the given storage key.
   *
   * R4 headers applied to the GetObjectCommand:
   *   - ResponseContentDisposition: 'attachment'         — force browser download, no inline rendering
   *   - ResponseContentType: <mimeType>                  — serve the correct MIME to the client
   *   - ResponseCacheControl: 'no-store' (SVG only)      — prevent caching of potentially-dangerous SVG
   *
   * The TTL cap (60–3600 s) is enforced by GetSignedUrlUseCase; this method trusts the caller.
   */
  async getSignedUrl(key: string, ttl: number, mimeType?: string): Promise<string> {
    const resolvedKey = this.extractKeyFromUrl(key);

    const commandParams: Record<string, string> = {
      Bucket: this.config.bucket,
      Key: resolvedKey,
      // R4 — content disposition: always force attachment (prevents inline SVG/HTML execution)
      ResponseContentDisposition: 'attachment',
    };

    // R4 — content type: include it in the presigned URL so the browser gets the right MIME
    if (mimeType) {
      commandParams['ResponseContentType'] = mimeType;
    }

    // R4 — SVG-specific cache control: no-store to prevent cached malicious payload surviving sanitizer updates
    if (mimeType === 'image/svg+xml') {
      commandParams['ResponseCacheControl'] = 'no-store';
    }

    const command = new GetObjectCommand(commandParams as any);

    const url = await awsGetSignedUrl(this.client, command, { expiresIn: ttl });

    this.logger.info('Presigned URL generated', {
      key: resolvedKey,
      bucket: this.config.bucket,
      ttl,
      mimeType,
    });

    return url;
  }

  // ---------------------------------------------------------------------------
  // Helpers (public so GetSignedUrlUseCase can reuse key extraction without duplication)
  // ---------------------------------------------------------------------------

  /**
   * Extract the S3 object key from a stored value that may be:
   *   - A full public URL: `${S3_PUBLIC_URL}/${key}` → strip the base URL prefix
   *   - A raw key path: already the key (no protocol prefix)
   *
   * The public URL base may end with a trailing slash or not — we handle both.
   * Exposed as public to allow reuse in GetSignedUrlUseCase (R note: no duplication).
   */
  public extractKeyFromUrl(fileUrl: string): string {
    if (!fileUrl) return '';

    // Full URL case: strip the publicUrl prefix (with or without trailing slash)
    const base = this.config.publicUrl.endsWith('/')
      ? this.config.publicUrl
      : `${this.config.publicUrl}/`;

    if (fileUrl.startsWith(base)) {
      return fileUrl.slice(base.length);
    }

    // Also handle full http(s):// URLs that don't match publicUrl (e.g. stored
    // before S3_PUBLIC_URL was reconfigured). Extract the path after the host.
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      try {
        const url = new URL(fileUrl);
        // pathname starts with '/' — strip it; the key may contain the bucket name
        // depending on path-style vs virtual-hosted layout. We strip only the leading '/'.
        return url.pathname.replace(/^\//, '');
      } catch {
        // Malformed URL — treat as raw key
      }
    }

    // Raw key: return as-is
    return fileUrl;
  }
}
