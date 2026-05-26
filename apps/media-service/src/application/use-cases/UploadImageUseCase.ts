import { ImageEntity, ImageEntityType } from '../../domain/entities/Image';
import { IImageRepository } from '../../domain/repositories/IImageRepository';
import { IStorageService } from '../../domain/interfaces/IStorageService';
import { LoggerFactory, ILogger } from '@hbs/logging';

export interface UploadImageRequest {
  file: any;
  entityType: ImageEntityType;
  entityId: string;
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
    const { file, entityType, entityId } = request;

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

    const timestamp = Date.now();
    const extension = fileInfo.filename.split('.').pop()?.toLowerCase() || 'jpg';
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

    const savedImage = await this.imageRepository.create(image);

    this.logger.info('Image uploaded successfully', {
      imageId: savedImage.id,
      entityType,
      entityId,
    });

    return savedImage;
  }

  private validateFile(file: any, fileInfo: any): void {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(fileInfo.mimetype)) {
      throw new Error('Invalid file type. Only JPEG, PNG and WEBP are allowed');
    }

    const maxSize = 5 * 1024 * 1024;
    if (fileInfo.size > maxSize) {
      throw new Error('File size too large. Maximum 5MB allowed');
    }
  }
}
