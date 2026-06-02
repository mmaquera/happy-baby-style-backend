export interface IStorageService {
  uploadFile(buffer: Buffer, fileName: string, mimeType: string, folder?: string): Promise<string>;
  deleteFile(fileUrl: string): Promise<void>;
  getPublicUrl(fileName: string, folder?: string): string;
  validateFile(fileName: string, mimeType: string, fileSize: number): boolean;
  /** Returns the logical bucket/container name for this storage backend.
   *  Local driver: 'local'. S3 driver: the value of S3_BUCKET_NAME. */
  getBucketName(): string;
}
