import { ImageEntity, ImageEntityType } from '@domain/entities/Image';
import { IImageRepository } from '@domain/repositories/IImageRepository';
import { IStorageService } from '@domain/interfaces/IStorageService';
import { Multer } from 'multer';

export interface UploadImageRequest {
  file: Express.Multer.File;
  entityType: ImageEntityType;
  entityId: string;
}

export class UploadImageUseCase {
  constructor(
    private readonly imageRepository: IImageRepository,
    private readonly storageService: IStorageService
  ) {}

  async execute(request: UploadImageRequest): Promise<ImageEntity> {
    const { file, entityType, entityId } = request;

    // Validaciones
    this.validateFile(file);

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const extension = this.getFileExtension(file.originalname);
    const fileName = `${entityType}_${entityId}_${timestamp}.${extension}`;
    const path = `${entityType}s/${entityId}/${fileName}`;

    try {
      // Subir archivo usando el storage service
      const url = await this.storageService.uploadFile(
        file.buffer,
        fileName,
        file.mimetype,
        `${entityType}s/${entityId}`
      );

      // Crear entidad de imagen
      const image = ImageEntity.create({
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url,
        bucket: 'images',
        path,
        entityType,
        entityId
      });

      // Guardar en base de datos
      return await this.imageRepository.create(image);
    } catch (error) {
      throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateFile(file: Express.Multer.File): void {
    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only JPEG, PNG and WEBP are allowed');
    }

    // Validar tamaño (5MB máximo)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum 5MB allowed');
    }
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || 'jpg';
  }
}