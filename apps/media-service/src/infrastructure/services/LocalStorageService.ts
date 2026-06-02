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
  baseUrl: process.env.STORAGE_BASE_URL || 'http://localhost:3004',
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

      // Control 5 — bounds-check: resolved path must stay inside the uploads directory
      const resolvedTargetDir = path.resolve(targetDir);
      const resolvedUploadDir = path.resolve(this.uploadDir);
      if (!resolvedTargetDir.startsWith(resolvedUploadDir + path.sep) && resolvedTargetDir !== resolvedUploadDir) {
        this.logger.error('Path traversal attempt detected', new Error('Path traversal'), {
          targetDir,
          resolvedTargetDir,
          resolvedUploadDir,
        });
        throw new FileUploadError('Invalid upload path', { fileName, mimeType });
      }

      if (folder) {
        await this.ensureDirectoryExists(targetDir);
      }

      const uniqueFileName = this.generateUniqueFileName(fileName, mimeType);
      const filePath = path.join(targetDir, uniqueFileName);

      // Control 5 — verify the final file path is still inside the uploads directory
      const resolvedFilePath = path.resolve(filePath);
      if (!resolvedFilePath.startsWith(resolvedUploadDir + path.sep)) {
        this.logger.error('Path traversal attempt on file path', new Error('Path traversal'), {
          filePath,
          resolvedFilePath,
          resolvedUploadDir,
        });
        throw new FileUploadError('Invalid upload path', { fileName, mimeType });
      }

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
      // Re-throw typed storage errors (FileValidationError, FileUploadError) directly so
      // that security-relevant messages (e.g. 'Invalid upload path') reach the caller.
      if (error instanceof FileValidationError) throw error;
      if (error instanceof FileUploadError) throw error;

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
      // fileUrl may be either a full URL ('http://localhost:3004/uploads/...') or a relative
      // path ('uploads/.../filename.jpg') — the latter is what LocalStorageService.uploadFile
      // returns and what is persisted in the DB url column.
      let relativePath: string;
      try {
        const url = new URL(fileUrl);
        relativePath = url.pathname.substring(1); // strip leading '/'
      } catch {
        // Not a valid URL — treat as a relative path directly.
        relativePath = fileUrl;
      }
      const filePath = path.join(process.cwd(), relativePath);

      // Control 5 — bounds-check: deletion must stay inside the uploads directory
      const resolvedFilePath = path.resolve(filePath);
      const resolvedUploadDir = path.resolve(this.uploadDir);
      if (!resolvedFilePath.startsWith(resolvedUploadDir + path.sep)) {
        this.logger.error('Path traversal attempt in deleteFile', new Error('Path traversal'), {
          fileUrl,
          resolvedFilePath,
          resolvedUploadDir,
        });
        throw new FileDeleteError('Invalid file path', { fileUrl });
      }

      try {
        await stat(filePath);
        await unlink(filePath);
        this.logger.info('File deleted', { fileUrl, filePath });
      } catch {
        this.logger.warn('File not found for deletion', { fileUrl, filePath });
      }
    } catch (error) {
      if (error instanceof FileDeleteError) throw error;

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
