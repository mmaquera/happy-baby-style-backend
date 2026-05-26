// Base class for domain errors
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    
    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details
    };
  }
}

// Validation Errors (400)
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, field?: string) {
    super(message, field ? { field } : undefined);
  }
}

export class RequiredFieldError extends ValidationError {
  constructor(fieldName: string) {
    super(`${fieldName} is required`, fieldName);
  }
}

export class InvalidFormatError extends ValidationError {
  constructor(fieldName: string, expectedFormat?: string) {
    super(
      `${fieldName} has invalid format${expectedFormat ? `. Expected: ${expectedFormat}` : ''}`,
      fieldName
    );
  }
}

export class InvalidRangeError extends ValidationError {
  constructor(fieldName: string, min?: number, max?: number) {
    const range = min !== undefined && max !== undefined 
      ? `between ${min} and ${max}`
      : min !== undefined 
        ? `at least ${min}`
        : max !== undefined 
          ? `at most ${max}`
          : 'within valid range';
    
    super(`${fieldName} must be ${range}`, fieldName);
  }
}

// Not Found Errors (404)
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;

  constructor(resource: string, identifier?: string) {
    super(
      `${resource}${identifier ? ` with identifier '${identifier}'` : ''} not found`,
      identifier ? { identifier } : undefined
    );
  }
}

// Conflict Errors (409)
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;

  constructor(message: string, conflictingValue?: string) {
    super(message, conflictingValue ? { conflictingValue } : undefined);
  }
}

export class DuplicateError extends ConflictError {
  constructor(resource: string, field: string, value: string) {
    super(`${resource} with ${field} '${value}' already exists`, value);
  }
}

// Business Logic Errors (422)
export class BusinessLogicError extends DomainError {
  readonly code = 'BUSINESS_LOGIC_ERROR';
  readonly statusCode = 422;

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

// Infrastructure Errors (500)
export class InfrastructureError extends DomainError {
  readonly code = 'INFRASTRUCTURE_ERROR';
  readonly statusCode = 500;

  constructor(message: string, originalError?: Error) {
    super(message, originalError ? { originalError: originalError.message } : undefined);
  }
}

export class DatabaseError extends InfrastructureError {
  constructor(operation: string, originalError?: Error) {
    super(`Database operation failed: ${operation}`, originalError);
  }
}

export class ExternalServiceError extends InfrastructureError {
  constructor(service: string, originalError?: Error) {
    super(`External service error: ${service}`, originalError);
  }
}

// Authorization Errors (401, 403)
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;

  constructor(message: string = 'Authentication required') {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;

  constructor(message: string = 'Access denied') {
    super(message);
  }
}