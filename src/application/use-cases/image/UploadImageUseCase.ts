import { ImageEntity, ImageEntityType } from '@domain/entities/Image';
import { IImageRepository } from '@domain/repositories/IImageRepository';
import { IStorageService } from '@domain/interfaces/IStorageService';
import { ILogger } from '@domain/interfaces/ILogger';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';
import { PerformanceLogger } from '@infrastructure/logging/PerformanceLogger';
import { Multer } from 'multer';

export interface UploadImageRequest {
  file: any; // ✅ CORRECCIÓN: Cambiar tipo para aceptar objeto Upload de graphql-upload
  entityType: ImageEntityType;
  entityId: string;
}

export class UploadImageUseCase {
  private readonly logger: ILogger;
  private readonly performanceLogger: PerformanceLogger;

  constructor(
    private readonly imageRepository: IImageRepository,
    private readonly storageService: IStorageService
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UploadImageUseCase');
    this.performanceLogger = new PerformanceLogger();
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    includeError: true,
    context: { useCase: 'UploadImage' }
  })
  async execute(request: UploadImageRequest): Promise<ImageEntity> {
    const { file, entityType, entityId } = request;
    const traceId = `upload-image-${Date.now()}-${entityId}`;

    // ✅ CORRECCIÓN: Resolver la Promise del objeto Upload de graphql-upload y obtener el buffer
    let resolvedFile: any;
    let fileBuffer: Buffer;
    
    try {
      // Resolver la Promise del objeto Upload para obtener el archivo real
      resolvedFile = await file.promise;
      
      this.logger.debug('File promise resolved successfully', {
        fileName: resolvedFile?.filename,
        mimeType: resolvedFile?.mimetype,
        encoding: resolvedFile?.encoding,
        hasCreateReadStream: !!resolvedFile?.createReadStream,
        context: 'UploadImageUseCase.resolveFilePromise'
      }, traceId);

      // ✅ CORRECCIÓN: Leer el stream del archivo para obtener el buffer
      if (!resolvedFile?.createReadStream) {
        throw new Error('File stream not available from graphql-upload');
      }

      const stream = resolvedFile.createReadStream();
      const chunks: Buffer[] = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      fileBuffer = Buffer.concat(chunks);
      
      this.logger.debug('File buffer created successfully', {
        fileName: resolvedFile?.filename,
        bufferSize: fileBuffer.length,
        context: 'UploadImageUseCase.createBuffer'
      }, traceId);
      
    } catch (error) {
      this.logger.error('Failed to resolve file promise or create buffer', error instanceof Error ? error : new Error('Unknown error'), {
        context: 'UploadImageUseCase.resolveFilePromise',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, traceId);
      throw new Error('Failed to process uploaded file');
    }

    // ✅ CORRECCIÓN: Acceder correctamente a las propiedades del archivo resuelto
    const fileInfo = {
      filename: resolvedFile?.filename || 'unknown',
      mimetype: resolvedFile?.mimetype || 'unknown',
      size: fileBuffer.length || 0,
      encoding: resolvedFile?.encoding || 'unknown',
      buffer: fileBuffer
    };

    // ✅ VALIDACIÓN: Verificar que el buffer existe
    if (!fileInfo.buffer || fileInfo.buffer.length === 0) {
      this.logger.error('File buffer is null, undefined or empty', new Error('File buffer validation failed'), {
        fileName: fileInfo.filename,
        mimeType: fileInfo.mimetype,
        bufferLength: fileInfo.buffer?.length || 0,
        context: 'UploadImageUseCase.validateBuffer'
      }, traceId);
      throw new Error('File buffer is missing or empty. Please try uploading the file again.');
    }

    // ✅ VALIDACIÓN: Verificar que el tamaño del archivo es válido
    if (fileInfo.size === 0) {
      this.logger.error('File size is 0', new Error('File size validation failed'), {
        fileName: fileInfo.filename,
        mimeType: fileInfo.mimetype,
        context: 'UploadImageUseCase.validateFileSize'
      }, traceId);
      throw new Error('File size is invalid. Please try uploading the file again.');
    }

    // Log operation start
    this.logger.info('Starting image upload process', {
      operation: 'uploadImage',
      entityType,
      entityId,
      fileName: fileInfo.filename,
      fileSize: fileInfo.size,
      mimeType: fileInfo.mimetype,
      encoding: fileInfo.encoding,
      context: 'UploadImageUseCase.execute'
    }, traceId);

    // Start performance measurement
    const operationId = this.performanceLogger.startTimer('uploadImageProcess', {
      entityType,
      entityId,
      fileSize: fileInfo.size,
      mimeType: fileInfo.mimetype
    });

    try {
      // Validaciones

      this.logger.debug('Validating uploaded file', {
        fileName: fileInfo.filename,
        fileSize: fileInfo.size,
        mimeType: fileInfo.mimetype,
        encoding: fileInfo.encoding,
        context: 'UploadImageUseCase.validateFile'
      }, traceId);

      this.validateFile(file);

      this.logger.debug('File validation successful', {
        fileName: fileInfo.filename,
        context: 'UploadImageUseCase.validateFile'
      }, traceId);

      // Generar nombre único para el archivo
      const timestamp = Date.now();
      const extension = this.getFileExtension(fileInfo.filename);
      const fileName = `${entityType}_${entityId}_${timestamp}.${extension}`;
      const path = `${entityType}s/${entityId}/${fileName}`;

      this.logger.debug('Generated unique filename', {
        originalName: fileInfo.filename,
        fileName,
        path,
        context: 'UploadImageUseCase.generateFileName'
      }, traceId);

      // Subir archivo usando el storage service
      this.logger.info('Uploading file to storage', {
        fileName,
        path,
        fileSize: fileInfo.size,
        context: 'UploadImageUseCase.storageUpload'
      }, traceId);

      const url = await this.storageService.uploadFile(
        fileInfo.buffer,
        fileName,
        fileInfo.mimetype,
        `${entityType}s/${entityId}`
      );

      this.logger.info('File uploaded to storage successfully', {
        fileName,
        url,
        context: 'UploadImageUseCase.storageUpload'
      }, traceId);

      // Crear entidad de imagen
      const image = ImageEntity.create({
        fileName,
        originalName: fileInfo.filename,
        mimeType: fileInfo.mimetype,
        size: fileInfo.size,
        url,
        bucket: 'images',
        path,
        entityType,
        entityId
      });

      this.logger.debug('Created image entity', {
        imageId: image.id,
        fileName,
        url,
        context: 'UploadImageUseCase.createEntity'
      }, traceId);

      // Guardar en base de datos
      this.logger.info('Saving image metadata to database', {
        imageId: image.id,
        entityType,
        entityId,
        context: 'UploadImageUseCase.saveMetadata'
      }, traceId);

      const savedImage = await this.imageRepository.create(image);

      // End performance measurement
      const measurement = this.performanceLogger.endTimer(operationId, {
        success: true,
        imageId: savedImage.id,
        url: savedImage.url
      });

      this.logger.info('Image upload process completed successfully', {
        imageId: savedImage.id,
        fileName,
        url: savedImage.url,
        duration: measurement?.duration,
        entityType,
        entityId,
        context: 'UploadImageUseCase.execute'
      }, traceId);

      return savedImage;
    } catch (error) {
      // End performance measurement with error
      this.performanceLogger.endTimer(operationId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.logger.error('Image upload process failed', error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'uploadImage',
        entityType,
        entityId,
        fileName: fileInfo.filename,
        fileSize: fileInfo.size,
        mimeType: fileInfo.mimetype,
        encoding: fileInfo.encoding,
        error: error instanceof Error ? error.message : 'Unknown error',
        context: 'UploadImageUseCase.execute'
      }, traceId);

      throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateFile(file: any): void {
    // ✅ CORRECCIÓN: Acceder correctamente a las propiedades del objeto Upload de graphql-upload
    const fileInfo = {
      filename: file?.file?.filename || file?.filename || 'unknown',
      mimetype: file?.file?.mimetype || file?.mimetype || 'unknown',
      size: file?.file?.size || file?.size || 0,
      encoding: file?.file?.encoding || file?.encoding || 'unknown'
    };

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(fileInfo.mimetype)) {
      this.logger.warn('Invalid file type detected', {
        fileName: fileInfo.filename,
        mimeType: fileInfo.mimetype,
        allowedTypes,
        context: 'UploadImageUseCase.validateFile'
      });
      throw new Error('Invalid file type. Only JPEG, PNG and WEBP are allowed');
    }

    // Validar tamaño (5MB máximo)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (fileInfo.size > maxSize) {
      this.logger.warn('File size exceeds maximum allowed', {
        fileName: fileInfo.filename,
        fileSize: fileInfo.size,
        maxSize,
        context: 'UploadImageUseCase.validateFile'
      });
      throw new Error('File size too large. Maximum 5MB allowed');
    }

    // ✅ LOGGING MEJORADO: Registrar información de validación exitosa
    this.logger.debug('File validation successful', {
      fileName: fileInfo.filename,
      mimeType: fileInfo.mimetype,
      fileSize: fileInfo.size,
      encoding: fileInfo.encoding,
      context: 'UploadImageUseCase.validateFile'
    });
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || 'jpg';
  }
}