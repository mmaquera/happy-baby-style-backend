export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly details?: Record<string, any>;

  constructor(message: string, details?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

export class RequiredFieldError extends DomainError {
  readonly code = 'REQUIRED_FIELD';
  readonly statusCode = 400;

  constructor(field: string) {
    super(`${field} is required`);
  }
}

export class InvalidFormatError extends DomainError {
  readonly code = 'INVALID_FORMAT';
  readonly statusCode = 400;

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}
