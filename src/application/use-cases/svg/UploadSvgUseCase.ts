import { SvgEntity, SvgEntityType } from '@domain/entities/Svg';
import { ISvgRepository } from '@domain/repositories/ISvgRepository';
import { IStorageService } from '@domain/interfaces/IStorageService';
import { ILogger } from '@domain/interfaces/ILogger';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';
import { PerformanceLogger } from '@infrastructure/logging/PerformanceLogger';
import { SvgValidationService } from '@application/validation/SvgValidationService';
import { ValidationError, RequiredFieldError, InvalidFormatError } from '@domain/errors/DomainError';
import { storageConfig } from '@config/storage';

export interface UploadSvgRequest {
  file: any; // GraphQL Upload object
  entityType: SvgEntityType;
  entityId: string;
  optimize?: boolean;
  sanitize?: boolean;
}

export class UploadSvgUseCase {
  private readonly logger: ILogger;
  private readonly performanceLogger: PerformanceLogger;

  constructor(
    private readonly svgRepository: ISvgRepository,
    private readonly storageService: IStorageService
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UploadSvgUseCase');
    this.performanceLogger = new PerformanceLogger();
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'UploadSvg' }
  })
  async execute(request: UploadSvgRequest): Promise<SvgEntity> {
    const { file, entityType, entityId, optimize = true, sanitize = true } = request;
    const traceId = `upload-svg-${Date.now()}-${entityId}`;

    this.logger.info('Starting SVG upload process', {
      entityType,
      entityId,
      optimize,
      sanitize,
      context: 'UploadSvgUseCase.execute'
    }, traceId);

    // Extract file information
    const fileInfo = this.extractFileInfo(file);

    this.logger.debug('File information extracted', {
      fileName: fileInfo.filename,
      fileSize: fileInfo.size,
      mimeType: fileInfo.mimetype,
      encoding: fileInfo.encoding,
      context: 'UploadSvgUseCase.extractFileInfo'
    }, traceId);

    // Start performance measurement
    const operationId = this.performanceLogger.startTimer('uploadSvgProcess', {
      entityType,
      entityId,
      fileSize: fileInfo.size,
      mimeType: fileInfo.mimetype
    });

    try {
      // Validate upload request
      this.logger.debug('Validating SVG upload request', {
        fileName: fileInfo.filename,
        fileSize: fileInfo.size,
        mimeType: fileInfo.mimetype,
        encoding: fileInfo.encoding,
        context: 'UploadSvgUseCase.validateRequest'
      }, traceId);

      SvgValidationService.validateSvgUploadRequest({ file, entityType, entityId });

      this.logger.debug('SVG upload request validation successful', {
        fileName: fileInfo.filename,
        context: 'UploadSvgUseCase.validateRequest'
      }, traceId);

      // Read SVG content first to get actual size
      const svgContent = await this.readSvgContent(file);
      
      this.logger.debug('SVG content read', {
        contentLength: svgContent.length,
        context: 'UploadSvgUseCase.readSvgContent'
      }, traceId);

      // Validate SVG file with actual content size
      SvgValidationService.validateSvgFile(file, svgContent.length);

      // Validate SVG content
      this.logger.debug('Validating SVG content', {
        contentLength: svgContent.length,
        context: 'UploadSvgUseCase.validateSvgContent'
      }, traceId);

      SvgValidationService.validateSvgContent(svgContent);

      this.logger.debug('SVG content validation successful', {
        contentLength: svgContent.length,
        context: 'UploadSvgUseCase.validateSvgContent'
      }, traceId);

      // Sanitize SVG content if requested
      let processedContent = svgContent;
      if (sanitize && storageConfig.svgConfig.enableSanitization) {
        this.logger.debug('Sanitizing SVG content', {
          originalLength: svgContent.length,
          context: 'UploadSvgUseCase.sanitizeContent'
        }, traceId);

        processedContent = SvgValidationService.sanitizeSvgContent(svgContent);

        this.logger.debug('SVG content sanitized', {
          originalLength: svgContent.length,
          sanitizedLength: processedContent.length,
          context: 'UploadSvgUseCase.sanitizeContent'
        }, traceId);
      }

      // Extract SVG metadata
      const metadata = SvgEntity.extractSvgMetadata(processedContent);
      
      this.logger.debug('SVG metadata extracted', {
        dimensions: metadata.dimensions,
        viewBox: metadata.viewBox,
        context: 'UploadSvgUseCase.extractMetadata'
      }, traceId);

      // Validate metadata
      SvgValidationService.validateSvgDimensions(metadata.dimensions);
      SvgValidationService.validateViewBox(metadata.viewBox);

      // Generate unique filename
      const timestamp = Date.now();
      const extension = this.getFileExtension(fileInfo.filename);
      const fileName = `${entityType}_${entityId}_${timestamp}.${extension}`;
      const path = `${entityType}s/${entityId}/${fileName}`;

      this.logger.debug('Generated unique filename', {
        originalName: fileInfo.filename,
        fileName,
        path,
        context: 'UploadSvgUseCase.generateFileName'
      }, traceId);

      // Convert processed content to buffer
      const buffer = Buffer.from(processedContent, 'utf8');

      // Upload file to storage
      this.logger.info('Uploading SVG to storage', {
        fileName,
        path,
        fileSize: buffer.length,
        context: 'UploadSvgUseCase.storageUpload'
      }, traceId);

      // Upload file and get relative path (without baseUrl for flexibility)
      const url = await this.storageService.uploadFile(
        buffer,
        fileName,
        fileInfo.mimetype,
        `${entityType}s/${entityId}`
      );

      this.logger.info('SVG uploaded to storage successfully', {
        fileName,
        relativePath: url, // Now contains relative path instead of full URL
        context: 'UploadSvgUseCase.storageUpload'
      }, traceId);

      // Create SVG entity
      const svg = SvgEntity.create({
        fileName,
        originalName: fileInfo.filename,
        mimeType: fileInfo.mimetype,
        size: buffer.length,
        url,
        bucket: 'local', // Assuming local storage
        path,
        entityType,
        entityId,
        dimensions: metadata.dimensions,
        viewBox: metadata.viewBox,
        optimized: optimize && storageConfig.svgConfig.enableOptimization
      });

      // Save to repository
      this.logger.info('Saving SVG entity to repository', {
        svgId: svg.id,
        fileName: svg.fileName,
        context: 'UploadSvgUseCase.saveToRepository'
      }, traceId);

      const savedSvg = await this.svgRepository.create(svg);

      const duration = Date.now() - Date.now();
      this.performanceLogger.endTimer(operationId, { 
        success: true,
        svgId: savedSvg.id,
        fileName: savedSvg.fileName,
        fileSize: savedSvg.size
      });

      this.logger.info('SVG upload process completed successfully', {
        svgId: savedSvg.id,
        fileName: savedSvg.fileName,
        relativePath: savedSvg.url, // Now contains relative path instead of full URL
        fileSize: savedSvg.size,
        duration,
        context: 'UploadSvgUseCase.execute'
      }, traceId);

      return savedSvg;

    } catch (error) {
      const duration = Date.now() - Date.now();
      this.performanceLogger.endTimer(operationId, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });

      this.logger.error('SVG upload process failed', error instanceof Error ? error : new Error(String(error)), {
        entityType,
        entityId,
        fileName: fileInfo.filename,
        fileSize: fileInfo.size,
        duration,
        context: 'UploadSvgUseCase.execute'
      }, traceId);

      throw error;
    }
  }

  /**
   * Extracts file information from upload object
   */
  private extractFileInfo(file: any): {
    filename: string;
    mimetype: string;
    size: number;
    encoding: string;
    buffer?: Buffer;
  } {
    return {
      filename: file?.file?.filename || file?.filename || 'unknown',
      mimetype: file?.file?.mimetype || file?.mimetype || 'unknown',
      size: file?.file?.size || file?.size || 0,
      encoding: file?.file?.encoding || file?.encoding || 'unknown',
      buffer: file?.file?.buffer || file?.buffer
    };
  }

  /**
   * Reads SVG content from upload object
   */
  private async readSvgContent(file: any): Promise<string> {
    try {
      // Handle different file object structures
      if (file?.file?.createReadStream) {
        // GraphQL Upload object
        return await this.readStreamContent(file.file.createReadStream());
      } else if (file?.createReadStream) {
        // Direct Upload object
        return await this.readStreamContent(file.createReadStream());
      } else if (file?.buffer) {
        // Buffer object
        return file.buffer.toString('utf8');
      } else if (file?.file?.buffer) {
        // Nested buffer object
        return file.file.buffer.toString('utf8');
      } else {
        throw new InvalidFormatError('Unable to read SVG content from file object');
      }
    } catch (error) {
      this.logger.error('Failed to read SVG content', error instanceof Error ? error : new Error(String(error)), {
        context: 'UploadSvgUseCase.readSvgContent'
      });
      throw new InvalidFormatError(`Failed to read SVG content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reads content from a stream
   */
  private async readStreamContent(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('utf8'));
      });
      
      stream.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Gets file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return 'svg'; // Default to svg if no extension
    }
    return filename.substring(lastDotIndex + 1);
  }

  /**
   * Validates file before processing
   */
  private validateFile(file: any): void {
    if (!file) {
      throw new RequiredFieldError('File is required');
    }

    const fileInfo = this.extractFileInfo(file);

    // Basic file validation
    if (!fileInfo.filename || fileInfo.filename.trim().length === 0) {
      throw new RequiredFieldError('Filename is required');
    }

    if (fileInfo.size === 0) {
      throw new InvalidFormatError('File cannot be empty');
    }

    if (fileInfo.size > storageConfig.svgConfig.maxFileSize) {
      throw new InvalidFormatError(
        `File size exceeds maximum allowed size of ${storageConfig.svgConfig.maxFileSize / (1024 * 1024)}MB`
      );
    }

    // Validate MIME type
    if (!storageConfig.svgConfig.allowedMimeTypes.includes(fileInfo.mimetype as any)) {
      throw new InvalidFormatError(
        `Invalid MIME type: ${fileInfo.mimetype}. Allowed types: ${storageConfig.svgConfig.allowedMimeTypes.join(', ')}`
      );
    }
  }
}
