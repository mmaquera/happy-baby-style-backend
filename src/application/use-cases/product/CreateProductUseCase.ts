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
import { ValidationService, createProductValidationRules } from '@application/validation/ValidationService';

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
      // Validación de input usando el servicio de validación
      ValidationService.validateBatch(request, createProductValidationRules);

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


}