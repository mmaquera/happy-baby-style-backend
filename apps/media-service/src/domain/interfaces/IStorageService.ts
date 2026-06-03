export interface IStorageService {
  uploadFile(buffer: Buffer, fileName: string, mimeType: string, folder?: string): Promise<string>;
  deleteFile(fileUrl: string): Promise<void>;
  getPublicUrl(fileName: string, folder?: string): string;
  validateFile(fileName: string, mimeType: string, fileSize: number): boolean;
  /** Returns the logical bucket/container name for this storage backend.
   *  Local driver: 'local'. S3 driver: the value of S3_BUCKET_NAME. */
  getBucketName(): string;
  /**
   * R6 — Returns a presigned GET URL for the given storage key valid for `ttl` seconds.
   * For the S3 driver, generates a real AWS presigned URL using GetObjectCommand with
   * ResponseContentDisposition, ResponseContentType, and (for SVG) ResponseCacheControl headers.
   * For the local driver, returns the plain public URL (no signing needed — public bucket).
   * The TTL cap (60-3600 s) must be enforced by the use-case caller BEFORE this is invoked.
   */
  getSignedUrl(key: string, ttl: number, mimeType?: string): Promise<string>;
}
