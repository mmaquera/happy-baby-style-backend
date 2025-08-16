import { ProductEntity } from '@domain/entities/Product';
import { IProductRepository } from '@domain/repositories/IProductRepository';
import { 
  RequiredFieldError, 
  InvalidRangeError, 
  DuplicateError, 
  BusinessLogicError,
  DatabaseError,
  ValidationError 
} from '@domain/errors/DomainError';

export interface CreateProductRequest {
  categoryId: string;
  name: string;
  description: string;
  price: number;
  salePrice?: number;
  sku: string;
  images?: string[];
  attributes?: Record<string, any>;
  stockQuantity?: number;
  tags?: string[];
  isActive?: boolean;
}

export class CreateProductUseCase {
  constructor(
    private readonly productRepository: IProductRepository
  ) {}

  async execute(request: CreateProductRequest): Promise<ProductEntity> {
    try {
      // Validación de input usando métodos locales
      this.validateInput(request);

      // Validar que el SKU sea único
      const existingProduct = await this.productRepository.findBySku(request.sku);
      if (existingProduct) {
        throw new DuplicateError('Product', 'SKU', request.sku);
      }

      // Crear producto
      const product = ProductEntity.create({
        categoryId: request.categoryId,
        name: request.name.trim(),
        description: request.description.trim(),
        price: request.price,
        salePrice: request.salePrice,
        sku: request.sku.trim().toUpperCase(),
        images: request.images || [],
        attributes: request.attributes || {},
        isActive: request.isActive ?? true,
        stockQuantity: request.stockQuantity || 0,
        tags: request.tags
      });

      return await this.productRepository.create(product);
    } catch (error) {
      // Re-throw validation and domain errors as-is
      if (error instanceof ValidationError || 
          error instanceof DuplicateError || 
          error instanceof BusinessLogicError) {
        throw error;
      }
      
      // Wrap infrastructure errors
      if (error instanceof Error) {
        throw new DatabaseError('create product', error);
      }
      
      throw new DatabaseError('create product');
    }
  }

  private validateInput(request: CreateProductRequest): void {
    // Validar campos obligatorios
    this.validateRequired('categoryId', request.categoryId);
    this.validateRequired('name', request.name);
    this.validateRequired('description', request.description);
    this.validateRequired('price', request.price);
    this.validateRequired('sku', request.sku);

    // Validar nombre
    this.validateString('name', request.name, { minLength: 1, maxLength: 255 });

    // Validar descripción
    this.validateString('description', request.description, { maxLength: 2000 });

    // Validar SKU
    this.validateString('sku', request.sku, { 
      minLength: 1, 
      maxLength: 50,
      pattern: /^[A-Z0-9\-_]+$/
    });

    // Validar precio
    this.validateNumber('price', request.price, { min: 0.01 });

    // Validar precio de venta si se proporciona
    if (request.salePrice !== undefined) {
      this.validateNumber('salePrice', request.salePrice, { min: 0.01 });
      if (request.salePrice >= request.price) {
        throw new ValidationError('Sale price must be less than regular price');
      }
    }

    // Validar cantidad de stock si se proporciona
    if (request.stockQuantity !== undefined) {
      this.validateNumber('stockQuantity', request.stockQuantity, { min: 0, integer: true });
    }

    // Validar imágenes si se proporcionan
    if (request.images !== undefined) {
      this.validateArray('images', request.images, {
        maxLength: 10,
        itemValidator: (item) => {
          this.validateString('image', item, { minLength: 1 });
        }
      });
    }

    // Validar tags si se proporcionan
    if (request.tags !== undefined) {
      this.validateArray('tags', request.tags, {
        maxLength: 20,
        itemValidator: (item) => {
          this.validateString('tag', item, { minLength: 1, maxLength: 50 });
        }
      });
    }
  }

  // Métodos de validación privados
  private validateRequired(field: string, value: any): void {
    if (value === undefined || value === null || 
        (typeof value === 'string' && value.trim().length === 0)) {
      throw new ValidationError(`Field '${field}' is required`);
    }
  }

  private validateString(field: string, value: any, options?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  }): void {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        throw new ValidationError(`Field '${field}' must be a string`);
      }

      if (options?.minLength && value.length < options.minLength) {
        throw new ValidationError(`Field '${field}' must be at least ${options.minLength} characters long`);
      }

      if (options?.maxLength && value.length > options.maxLength) {
        throw new ValidationError(`Field '${field}' must not exceed ${options.maxLength} characters`);
      }

      if (options?.pattern && !options.pattern.test(value)) {
        throw new ValidationError(`Field '${field}' has an invalid format`);
      }
    }
  }

  private validateNumber(field: string, value: any, options?: {
    min?: number;
    max?: number;
    integer?: boolean;
  }): void {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new ValidationError(`Field '${field}' must be a number`);
      }

      if (options?.integer && !Number.isInteger(value)) {
        throw new ValidationError(`Field '${field}' must be an integer`);
      }

      if (options?.min !== undefined && value < options.min) {
        throw new ValidationError(`Field '${field}' must be at least ${options.min}`);
      }

      if (options?.max !== undefined && value > options.max) {
        throw new ValidationError(`Field '${field}' must not exceed ${options.max}`);
      }
    }
  }

  private validateArray(field: string, value: any, options?: {
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: any, index: number) => void;
  }): void {
    if (value !== undefined && value !== null) {
      if (!Array.isArray(value)) {
        throw new ValidationError(`Field '${field}' must be an array`);
      }

      if (options?.minLength && value.length < options.minLength) {
        throw new ValidationError(`Field '${field}' must have at least ${options.minLength} items`);
      }

      if (options?.maxLength && value.length > options.maxLength) {
        throw new ValidationError(`Field '${field}' must not exceed ${options.maxLength} items`);
      }

      if (options?.itemValidator) {
        value.forEach((item, index) => {
          try {
            options.itemValidator!(item, index);
          } catch (error) {
            if (error instanceof ValidationError) {
              throw new ValidationError(`${field}[${index}]: ${error.message}`);
            }
            throw error;
          }
        });
      }
    }
  }
}