import { ProductEntity } from '../../domain/entities/Product';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import {
  ValidationError,
  DuplicateError,
  BusinessLogicError,
  DatabaseError,
} from '../../domain/errors/DomainError';

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
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(request: CreateProductRequest): Promise<ProductEntity> {
    this.validateInput(request);

    const existingProduct = await this.productRepository.findBySku(request.sku);
    if (existingProduct) {
      throw new DuplicateError('Product', 'SKU', request.sku);
    }

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
      tags: request.tags,
    });

    try {
      return await this.productRepository.create(product);
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof DuplicateError ||
        error instanceof BusinessLogicError
      ) {
        throw error;
      }
      if (error instanceof Error) {
        throw new DatabaseError('create product', error);
      }
      throw new DatabaseError('create product');
    }
  }

  private validateInput(request: CreateProductRequest): void {
    if (!request.categoryId) throw new ValidationError("Field 'categoryId' is required");
    if (!request.name?.trim()) throw new ValidationError("Field 'name' is required");
    if (!request.description?.trim()) throw new ValidationError("Field 'description' is required");
    if (!request.price) throw new ValidationError("Field 'price' is required");
    if (!request.sku?.trim()) throw new ValidationError("Field 'sku' is required");

    if (request.price < 0.01) throw new ValidationError("Field 'price' must be at least 0.01");

    if (request.salePrice !== undefined) {
      if (request.salePrice < 0.01)
        throw new ValidationError("Field 'salePrice' must be at least 0.01");
      if (request.salePrice >= request.price)
        throw new ValidationError('Sale price must be less than regular price');
    }

    if (request.stockQuantity !== undefined && request.stockQuantity < 0) {
      throw new ValidationError("Field 'stockQuantity' must be non-negative");
    }

    if (request.images && request.images.length > 10) {
      throw new ValidationError("Field 'images' must not exceed 10 items");
    }
  }
}
