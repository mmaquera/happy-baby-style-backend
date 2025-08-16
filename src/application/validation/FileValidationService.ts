import { IFileValidationService } from '../../domain/interfaces/IFileValidationService';
import { ValidationError } from '../../domain/errors/DomainError';

export class FileValidationService implements IFileValidationService {
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain'
  ];

  validateFile(fileName: string, mimeType: string, fileSize: number): void {
    // Validate file name
    if (!fileName || fileName.trim().length === 0) {
      throw new ValidationError('File name is required');
    }

    if (fileName.length > 255) {
      throw new ValidationError('File name is too long (max 255 characters)');
    }

    // Validate mime type
    if (!mimeType || !this.allowedMimeTypes.includes(mimeType)) {
      throw new ValidationError(`Invalid mime type. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
    }

    // Validate file size
    if (fileSize <= 0) {
      throw new ValidationError('File size must be greater than 0');
    }

    if (fileSize > this.maxFileSize) {
      throw new ValidationError(`File size exceeds maximum allowed size of ${this.maxFileSize / (1024 * 1024)}MB`);
    }
  }

  getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'text/plain': '.txt'
    };

    return mimeToExt[mimeType] || '.bin';
  }
}
