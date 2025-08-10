import { ValidationError, RequiredFieldError, InvalidFormatError, InvalidRangeError } from '@domain/errors/DomainError';

export interface ValidationRule<T = any> {
  field: keyof T;
  validate: (value: any, data: T) => void;
}

export class ValidationService {
  static validateRequired<T>(field: keyof T, value: any): void {
    if (value === undefined || value === null || 
        (typeof value === 'string' && value.trim().length === 0)) {
      throw new RequiredFieldError(String(field));
    }
  }

  static validateString<T>(field: keyof T, value: any, options?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  }): void {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        throw new InvalidFormatError(String(field), 'string');
      }

      if (options?.minLength && value.length < options.minLength) {
        throw new InvalidRangeError(String(field), options.minLength);
      }

      if (options?.maxLength && value.length > options.maxLength) {
        throw new InvalidRangeError(String(field), undefined, options.maxLength);
      }

      if (options?.pattern && !options.pattern.test(value)) {
        throw new InvalidFormatError(String(field), `pattern: ${options.pattern}`);
      }
    }
  }

  static validateNumber<T>(field: keyof T, value: any, options?: {
    min?: number;
    max?: number;
    integer?: boolean;
  }): void {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new InvalidFormatError(String(field), 'number');
      }

      if (options?.integer && !Number.isInteger(value)) {
        throw new InvalidFormatError(String(field), 'integer');
      }

      if (options?.min !== undefined && value < options.min) {
        throw new InvalidRangeError(String(field), options.min);
      }

      if (options?.max !== undefined && value > options.max) {
        throw new InvalidRangeError(String(field), undefined, options.max);
      }
    }
  }

  static validateEmail<T>(field: keyof T, value: any): void {
    if (value !== undefined && value !== null) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof value !== 'string' || !emailRegex.test(value)) {
        throw new InvalidFormatError(String(field), 'valid email');
      }
    }
  }

  static validateArray<T>(field: keyof T, value: any, options?: {
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: any, index: number) => void;
  }): void {
    if (value !== undefined && value !== null) {
      if (!Array.isArray(value)) {
        throw new InvalidFormatError(String(field), 'array');
      }

      if (options?.minLength && value.length < options.minLength) {
        throw new InvalidRangeError(String(field), options.minLength);
      }

      if (options?.maxLength && value.length > options.maxLength) {
        throw new InvalidRangeError(String(field), undefined, options.maxLength);
      }

      if (options?.itemValidator) {
        value.forEach((item, index) => {
          try {
            options.itemValidator!(item, index);
          } catch (error) {
            if (error instanceof ValidationError) {
              throw new ValidationError(`${String(field)}[${index}]: ${error.message}`);
            }
            throw error;
          }
        });
      }
    }
  }

  static validateEnum<T>(field: keyof T, value: any, allowedValues: any[]): void {
    if (value !== undefined && value !== null) {
      if (!allowedValues.includes(value)) {
        throw new InvalidFormatError(String(field), `one of: ${allowedValues.join(', ')}`);
      }
    }
  }

  static validateDate<T>(field: keyof T, value: any, options?: {
    minDate?: Date;
    maxDate?: Date;
  }): void {
    if (value !== undefined && value !== null) {
      let date: Date;
      
      if (value instanceof Date) {
        date = value;
      } else if (typeof value === 'string') {
        date = new Date(value);
      } else {
        throw new InvalidFormatError(String(field), 'date');
      }

      if (isNaN(date.getTime())) {
        throw new InvalidFormatError(String(field), 'valid date');
      }

      if (options?.minDate && date < options.minDate) {
        throw new InvalidRangeError(String(field), undefined, undefined);
      }

      if (options?.maxDate && date > options.maxDate) {
        throw new InvalidRangeError(String(field), undefined, undefined);
      }
    }
  }

  static validateObject<T>(field: keyof T, value: any, options?: {
    schema?: ValidationRule<any>[];
  }): void {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new InvalidFormatError(String(field), 'object');
      }

      if (options?.schema) {
        options.schema.forEach(rule => {
          rule.validate(value[rule.field], value);
        });
      }
    }
  }

  static validateConditional<T>(
    condition: (data: T) => boolean,
    validation: (data: T) => void
  ): (data: T) => void {
    return (data: T) => {
      if (condition(data)) {
        validation(data);
      }
    };
  }

  static validateBatch<T>(data: T, rules: ValidationRule<T>[]): void {
    const errors: ValidationError[] = [];

    rules.forEach(rule => {
      try {
        rule.validate(data[rule.field], data);
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(error);
        }
      }
    });

    if (errors.length > 0) {
      throw new ValidationError(
        `Multiple validation errors: ${errors.map(e => e.message).join(', ')}`,
        undefined
      );
    }
  }
}

// Product validation schemas
export const createProductValidationRules: ValidationRule<any>[] = [
  {
    field: 'name',
    validate: (value) => {
      ValidationService.validateRequired('name', value);
      ValidationService.validateString('name', value, { minLength: 1, maxLength: 255 });
    }
  },
  {
    field: 'description',
    validate: (value) => {
      ValidationService.validateString('description', value, { maxLength: 2000 });
    }
  },
  {
    field: 'sku',
    validate: (value) => {
      ValidationService.validateRequired('sku', value);
      ValidationService.validateString('sku', value, { 
        minLength: 1, 
        maxLength: 50,
        pattern: /^[A-Z0-9\-_]+$/
      });
    }
  },
  {
    field: 'price',
    validate: (value) => {
      ValidationService.validateRequired('price', value);
      ValidationService.validateNumber('price', value, { min: 0.01 });
    }
  },
  {
    field: 'salePrice',
    validate: (value, data) => {
      if (value !== undefined) {
        ValidationService.validateNumber('salePrice', value, { min: 0.01 });
        if (data.price && value >= data.price) {
          throw new ValidationError('Sale price must be less than regular price');
        }
      }
    }
  },
  {
    field: 'stockQuantity',
    validate: (value) => {
      if (value !== undefined) {
        ValidationService.validateNumber('stockQuantity', value, { min: 0, integer: true });
      }
    }
  },
  {
    field: 'images',
    validate: (value) => {
      ValidationService.validateArray('images', value, {
        maxLength: 10,
        itemValidator: (item) => {
          ValidationService.validateString('image', item, { minLength: 1 });
        }
      });
    }
  },
  {
    field: 'tags',
    validate: (value) => {
      ValidationService.validateArray('tags', value, {
        maxLength: 20,
        itemValidator: (item) => {
          ValidationService.validateString('tag', item, { minLength: 1, maxLength: 50 });
        }
      });
    }
  }
];