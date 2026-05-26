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
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

// Inlined from @config/storage
const storageConfig = {
  baseUrl: process.env.STORAGE_BASE_URL || 'http://localhost:3001',
  uploadDir: process.env.STORAGE_UPLOAD_DIR || 'uploads',
};

export class LocalStorageService implements IStorageService {
  private readonly baseUrl: string;
  private readonly uploadDir: string;
  private readonly validationService: IFileValidationService;
  private readonly logger: ILogger;

  constructor(logger?: ILogger, validationService?: IFileValidationService) {
    this.baseUrl = storageConfig.baseUrl;
    this.uploadDir = path.join(process.cwd(), storageConfig.uploadDir);
    this.validationService = validationService || new FileValidationService();
    this.logger = logger || LoggerFactory.getInstance().createServiceLogger('LocalStorageService');
    this.ensureUploadDirExists();
  }

  private async ensureUploadDirExists(): Promise<void> {
    try {
      await stat(this.uploadDir);
    } catch {
      try {
        await mkdir(this.uploadDir, { recursive: true });
        this.logger.info('Created upload directory', { path: this.uploadDir });
      } catch (mkdirError) {
        const msg = mkdirError instanceof Error ? mkdirError.message : 'Unknown error';
        throw new StorageConfigurationError('Failed to create upload directory', {
          path: this.uploadDir,
          originalError: msg,
        });
      }
    }
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folder?: string,
  ): Promise<string> {
    try {
      this.validationService.validateFile(fileName, mimeType, buffer.length);

      const targetDir = folder ? path.join(this.uploadDir, folder) : this.uploadDir;

      if (folder) {
        await this.ensureDirectoryExists(targetDir);
      }

      const uniqueFileName = this.generateUniqueFileName(fileName, mimeType);
      const filePath = path.join(targetDir, uniqueFileName);

      await writeFile(filePath, buffer);

      const relativePath = folder
        ? `${storageConfig.uploadDir}/${folder}/${uniqueFileName}`
        : `${storageConfig.uploadDir}/${uniqueFileName}`;

      this.logger.info('File uploaded', {
        fileName,
        uniqueFileName,
        relativePath,
        fileSize: buffer.length,
      });

      return relativePath;
    } catch (error) {
      if (error instanceof FileValidationError) throw error;

      this.logger.error(
        'File upload failed',
        error instanceof Error ? error : new Error('Unknown error'),
      );
      throw new FileUploadError('Failed to upload file', {
        fileName,
        mimeType,
        fileSize: buffer.length,
        originalError: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const url = new URL(fileUrl);
      const relativePath = url.pathname.substring(1);
      const filePath = path.join(process.cwd(), relativePath);

      try {
        await stat(filePath);
        await unlink(filePath);
        this.logger.info('File deleted', { fileUrl, filePath });
      } catch {
        this.logger.warn('File not found for deletion', { fileUrl, filePath });
      }
    } catch (error) {
      this.logger.error(
        'File deletion failed',
        error instanceof Error ? error : new Error('Unknown error'),
      );
      throw new FileDeleteError('Failed to delete file', {
        fileUrl,
        originalError: error instanceof Error ? error.message : 'Unknown error',
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
    } catch {
      return false;
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await stat(dirPath);
    } catch {
      await mkdir(dirPath, { recursive: true });
    }
  }

  private generateUniqueFileName(fileName: string, mimeType: string): string {
    const timestamp = Date.now();
    const ext = this.validationService.getExtensionFromMimeType(mimeType);
    const baseName = path.basename(fileName, path.extname(fileName));
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${sanitizedBaseName}_${timestamp}${ext}`;
  }
}
