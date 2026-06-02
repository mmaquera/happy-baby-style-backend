import type { TokenPayload } from '@hbs/auth';
import { ImageEntity, ImageEntityType } from '../../domain/entities/Image';
import { IImageRepository } from '../../domain/repositories/IImageRepository';
import { IStorageService } from '../../domain/interfaces/IStorageService';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { ValidationError } from '../../domain/errors/DomainError';

// Control 7 — single allowlist: MIME → canonical extension (derived from validated MIME only)
const ALLOWED_IMAGE_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface UploadImageRequest {
  file: any;
  entityType: ImageEntityType;
  entityId: string;
  currentUser?: TokenPayload | null;
}

export class UploadImageUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly imageRepository: IImageRepository,
    private readonly storageService: IStorageService,
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UploadImageUseCase');
  }

  async execute(request: UploadImageRequest): Promise<ImageEntity> {
    const { file, entityType, entityId, currentUser = null } = request;

    // Control 5 — validate entityId before any path or filename construction
    if (!/^[a-zA-Z0-9-_]+$/.test(entityId)) {
      throw new ValidationError(
        'entityId must contain only alphanumeric characters, hyphens, and underscores',
        'entityId',
      );
    }

    let resolvedFile: any;
    let fileBuffer: Buffer;

    try {
      resolvedFile = await file.promise;

      if (!resolvedFile?.createReadStream) {
        throw new Error('File stream not available from graphql-upload');
      }

      const stream = resolvedFile.createReadStream();
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      fileBuffer = Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(
        'Failed to resolve file or create buffer',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw new Error('Failed to process uploaded file');
    }

    const fileInfo = {
      filename: resolvedFile?.filename || 'unknown',
      mimetype: resolvedFile?.mimetype || 'unknown',
      size: fileBuffer.length,
      encoding: resolvedFile?.encoding || 'unknown',
      buffer: fileBuffer,
    };

    if (!fileInfo.buffer || fileInfo.buffer.length === 0) {
      throw new Error('File buffer is missing or empty. Please try uploading the file again.');
    }

    if (fileInfo.size === 0) {
      throw new Error('File size is invalid. Please try uploading the file again.');
    }

    this.validateFile(file, fileInfo);

    // Control 7 — derive extension from validated MIME type, never from the
    // client-supplied filename (prevents extension spoofing).
    const timestamp = Date.now();
    const extension = ALLOWED_IMAGE_MIME_TYPES[fileInfo.mimetype] ?? 'jpg';
    const fileName = `${entityType}_${entityId}_${timestamp}.${extension}`;

    const url = await this.storageService.uploadFile(
      fileInfo.buffer,
      fileName,
      fileInfo.mimetype,
      `${entityType}s/${entityId}`,
    );

    const image = ImageEntity.create({
      fileName,
      originalName: fileInfo.filename,
      mimeType: fileInfo.mimetype,
      size: fileInfo.size,
      url,
      bucket: 'images',
      path: `${entityType}s/${entityId}/${fileName}`,
      entityType,
      entityId,
    });

    const savedImage = await this.imageRepository.create(image, currentUser);

    this.logger.info('Image uploaded successfully', {
      imageId: savedImage.id,
      entityType,
      entityId,
    });

    return savedImage;
  }

  private validateFile(file: any, fileInfo: any): void {
    // Control 8 — use module-level ALLOWED_IMAGE_MIME_TYPES as single source of truth
    if (!(fileInfo.mimetype in ALLOWED_IMAGE_MIME_TYPES)) {
      throw new ValidationError(
        `Invalid file type "${fileInfo.mimetype}". Only JPEG, PNG and WEBP are allowed`,
        'mimeType',
      );
    }

    const maxSize = 5 * 1024 * 1024;
    if (fileInfo.size > maxSize) {
      throw new ValidationError('File size too large. Maximum 5MB allowed', 'size');
    }
  }
}
