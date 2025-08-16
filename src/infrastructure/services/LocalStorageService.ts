import { IStorageService } from '../../domain/interfaces/IStorageService';
import { IFileValidationService } from '../../domain/interfaces/IFileValidationService';
import { FileValidationService } from '../../application/validation/FileValidationService';
import { 
  FileUploadError, 
  FileDeleteError, 
  FileValidationError,
  StorageConfigurationError
} from '../../domain/errors/StorageError';
import { storageConfig } from '../../config/storage';
import { ILogger } from '../../domain/interfaces/ILogger';
import { LoggerFactory } from '../logging/LoggerFactory';
import { PerformanceLogger } from '../logging/PerformanceLogger';
import { BaseResponse } from '../../shared/types/BaseResponse';
import { ResponseFactory } from '../../shared/factories/ResponseFactory';
import { RESPONSE_CODES } from '../../shared/constants/ResponseCodes';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

export class LocalStorageService implements IStorageService {
  private readonly baseUrl: string;
  private readonly uploadDir: string;
  private readonly validationService: IFileValidationService;
  private readonly logger: ILogger;
  private readonly performanceLogger: PerformanceLogger;

  constructor(
    logger?: ILogger, 
    validationService?: IFileValidationService
  ) {
    this.baseUrl = storageConfig.baseUrl;
    this.uploadDir = path.join(process.cwd(), storageConfig.uploadDir);
    this.validationService = validationService || new FileValidationService();
    this.logger = logger || LoggerFactory.getInstance().createServiceLogger('LocalStorageService');
    this.performanceLogger = new PerformanceLogger();
    this.ensureUploadDirExists();
  }

  private async ensureUploadDirExists(): Promise<void> {
    try {
      await stat(this.uploadDir);
      this.logger.debug('Upload directory already exists', { 
        path: this.uploadDir,
        context: 'LocalStorageService.ensureUploadDirExists'
      });
    } catch (error) {
      try {
        await mkdir(this.uploadDir, { recursive: true });
        this.logger.info('Created upload directory', { 
          path: this.uploadDir,
          context: 'LocalStorageService.ensureUploadDirExists'
        });
      } catch (mkdirError) {
        const errorMessage = mkdirError instanceof Error ? mkdirError.message : 'Unknown error';
        this.logger.error('Failed to create upload directory', new Error(errorMessage), { 
          path: this.uploadDir, 
          context: 'LocalStorageService.ensureUploadDirExists'
        });
        throw new StorageConfigurationError('Failed to create upload directory', { 
          path: this.uploadDir,
          originalError: errorMessage
        });
      }
    }
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folder?: string
  ): Promise<string> {
    const startTime = Date.now();
    const operationId = this.performanceLogger.startTimer('fileUpload', { 
      fileName, 
      mimeType, 
      fileSize: buffer.length,
      folder: folder || 'root'
    });

    try {
      this.logger.info('Starting file upload', { 
        fileName, 
        mimeType, 
        fileSize: buffer.length,
        folder: folder || 'root',
        context: 'LocalStorageService.uploadFile'
      });

      // Validate file before processing
      this.validationService.validateFile(fileName, mimeType, buffer.length);

      // Create subfolder if specified
      const targetDir = folder 
        ? path.join(this.uploadDir, folder)
        : this.uploadDir;

      if (folder) {
        await this.ensureDirectoryExists(targetDir);
      }

      // Generate unique filename
      const uniqueFileName = this.generateUniqueFileName(fileName, mimeType);
      const filePath = path.join(targetDir, uniqueFileName);
      
      // Write file
      await writeFile(filePath, buffer);

      // Return public URL
      const relativePath = folder 
        ? `${storageConfig.uploadDir}/${folder}/${uniqueFileName}`
        : `${storageConfig.uploadDir}/${uniqueFileName}`;
        
      const publicUrl = `${this.baseUrl}/${relativePath}`;

      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { 
        success: true,
        publicUrl,
        uniqueFileName
      });

      this.logger.info('File upload completed successfully', { 
        fileName, 
        uniqueFileName,
        publicUrl,
        fileSize: buffer.length,
        duration,
        context: 'LocalStorageService.uploadFile'
      });

      return publicUrl;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof FileValidationError) {
        this.logger.warn('File validation failed during upload', { 
          fileName, 
          mimeType, 
          error: error.message,
          details: error.details,
          duration,
          context: 'LocalStorageService.uploadFile'
        });
        throw error;
      }

      this.logger.error('File upload failed', error instanceof Error ? error : new Error('Unknown error'), { 
        fileName, 
        mimeType, 
        fileSize: buffer.length,
        duration,
        context: 'LocalStorageService.uploadFile'
      });

      throw new FileUploadError('Failed to upload file', { 
        fileName,
        mimeType,
        fileSize: buffer.length,
        originalError: error instanceof Error ? error.message : 'Unknown error',
        duration
      });
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    const startTime = Date.now();
    const operationId = this.performanceLogger.startTimer('fileDeletion', { fileUrl });

    try {
      this.logger.info('Starting file deletion', { 
        fileUrl,
        context: 'LocalStorageService.deleteFile'
      });

      // Extract relative path from URL
      const url = new URL(fileUrl);
      const relativePath = url.pathname.substring(1); // Remove leading '/'
      const filePath = path.join(process.cwd(), relativePath);

      // Check if file exists and delete
      try {
        await stat(filePath);
        await unlink(filePath);
        
        const duration = Date.now() - startTime;
        this.performanceLogger.endTimer(operationId, { 
          success: true,
          filePath
        });
        
        this.logger.info('File deleted successfully', { 
          fileUrl, 
          filePath,
          duration,
          context: 'LocalStorageService.deleteFile'
        });
      } catch (error) {
        // File doesn't exist, that's okay
        const duration = Date.now() - startTime;
        this.performanceLogger.endTimer(operationId, { 
          success: true,
          fileNotFound: true
        });
        
        this.logger.warn('File not found for deletion', { 
          fileUrl, 
          filePath,
          duration,
          context: 'LocalStorageService.deleteFile'
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceLogger.endTimer(operationId, { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.logger.error('File deletion failed', error instanceof Error ? error : new Error('Unknown error'), { 
        fileUrl, 
        duration,
        context: 'LocalStorageService.deleteFile'
      });

      throw new FileDeleteError('Failed to delete file', { 
        fileUrl,
        originalError: error instanceof Error ? error.message : 'Unknown error',
        duration
      });
    }
  }

  getPublicUrl(fileName: string, folder?: string): string {
    const relativePath = folder 
      ? `${storageConfig.uploadDir}/${folder}/${fileName}`
      : `${storageConfig.uploadDir}/${fileName}`;
      
    return `${this.baseUrl}/${relativePath}`;
  }

  validateFile(fileName: string, mimeType: string, fileSize: number): boolean {
    try {
      this.validationService.validateFile(fileName, mimeType, fileSize);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Method to get upload response following GraphQL standards
  getUploadResponse(
    fileName: string,
    publicUrl: string,
    requestId?: string,
    traceId?: string
  ): BaseResponse<{ url: string; fileName: string }> {
    return ResponseFactory.createSuccessResponse(
      {
        url: publicUrl,
        fileName
      },
      'File uploaded successfully',
      RESPONSE_CODES.CREATED,
      {
        requestId,
        traceId
      }
    );
  }

  // Method to get deletion response following GraphQL standards
  getDeletionResponse(
    fileUrl: string,
    requestId?: string,
    traceId?: string
  ): BaseResponse<{ fileUrl: string; deletedAt: string }> {
    return ResponseFactory.createSuccessResponse(
      {
        fileUrl,
        deletedAt: new Date().toISOString()
      },
      'File deleted successfully',
      RESPONSE_CODES.DELETED,
      {
        requestId,
        traceId
      }
    );
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await stat(dirPath);
    } catch (error) {
      await mkdir(dirPath, { recursive: true });
      this.logger.debug('Created subdirectory', { 
        path: dirPath,
        context: 'LocalStorageService.ensureDirectoryExists'
      });
    }
  }

  private generateUniqueFileName(fileName: string, mimeType: string): string {
    const timestamp = Date.now();
    const ext = this.validationService.getExtensionFromMimeType(mimeType);
    const baseName = path.basename(fileName, path.extname(fileName));
    
    // Sanitize base name to remove any remaining invalid characters
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    return `${sanitizedBaseName}_${timestamp}${ext}`;
  }
}