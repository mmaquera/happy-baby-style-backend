import { IFileValidationService } from '../../domain/interfaces/IFileValidationService';
import { ValidationError } from '../../domain/errors/DomainError';

// Control 8 — single allowlist for all file types handled by this service.
// Must match the types accepted by UploadImageUseCase (images) and UploadSvgUseCase (SVGs).
// gif, pdf, txt are intentionally excluded — no upload use case accepts them.
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'application/svg+xml': '.svg',
};

// Per-type size caps — must stay aligned with the upload use cases.
// Images: 5MB (UploadImageUseCase). SVGs: 2MB (SvgValidationService.MAX_SVG_SIZE).
const MAX_SIZE_BY_MIME: Record<string, number> = {
  'image/jpeg': 5 * 1024 * 1024,
  'image/jpg': 5 * 1024 * 1024,
  'image/png': 5 * 1024 * 1024,
  'image/webp': 5 * 1024 * 1024,
  'image/svg+xml': 2 * 1024 * 1024,
  'application/svg+xml': 2 * 1024 * 1024,
};

export class FileValidationService implements IFileValidationService {
  validateFile(fileName: string, mimeType: string, fileSize: number): void {
    if (!fileName || fileName.trim().length === 0) {
      throw new ValidationError('File name is required');
    }

    if (fileName.length > 255) {
      throw new ValidationError('File name is too long (max 255 characters)');
    }

    if (!mimeType || !(mimeType in ALLOWED_MIME_TO_EXT)) {
      throw new ValidationError(
        `Invalid mime type. Allowed types: ${Object.keys(ALLOWED_MIME_TO_EXT).join(', ')}`,
      );
    }

    if (fileSize <= 0) {
      throw new ValidationError('File size must be greater than 0');
    }

    const maxSize = MAX_SIZE_BY_MIME[mimeType]!;
    if (fileSize > maxSize) {
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`,
      );
    }
  }

  getExtensionFromMimeType(mimeType: string): string {
    return ALLOWED_MIME_TO_EXT[mimeType] ?? '.bin';
  }
}
