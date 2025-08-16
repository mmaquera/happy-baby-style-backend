import { DomainError } from './DomainError';

export class FileUploadError extends DomainError {
  readonly code = 'FILE_UPLOAD_ERROR';
  readonly statusCode = 500;

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

export class FileDeleteError extends DomainError {
  readonly code = 'FILE_DELETE_ERROR';
  readonly statusCode = 500;

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

export class FileValidationError extends DomainError {
  readonly code = 'FILE_VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

export class StorageConfigurationError extends DomainError {
  readonly code = 'STORAGE_CONFIGURATION_ERROR';
  readonly statusCode = 500;

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}
