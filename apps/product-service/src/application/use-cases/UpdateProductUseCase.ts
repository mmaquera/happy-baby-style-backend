import { ProductEntity } from '../../domain/entities/Product';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { ValidationError } from '../../domain/errors/DomainError';

export interface UpdateProductRequest {
  id: string;
  categoryId?: string;
  name?: string;
  description?: string;
  price?: number;
  salePrice?: number;
  sku?: string;
  images?: string[];
  attributes?: any;
  isActive?: boolean;
  stockQuantity?: number;
  tags?: string[];
  rating?: number;
  reviewCount?: number;
}

export class UpdateProductUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(request: UpdateProductRequest): Promise<ProductEntity> {
    if (!request.id) throw new Error('Product ID is required');

    const existingProduct = await this.productRepository.findById(request.id);
    if (!existingProduct) throw new Error('Product not found');

    if (request.sku && request.sku !== existingProduct.sku) {
      const existingSku = await this.productRepository.findBySku(request.sku);
      if (existingSku) throw new Error('SKU already exists');
    }

    if (request.price !== undefined && request.price < 0) throw new ValidationError('Price must be non-negative');
    if (request.salePrice !== undefined && request.salePrice < 0) throw new ValidationError('Sale price must be non-negative');
    if (request.salePrice !== undefined && request.price !== undefined && request.salePrice >= request.price) {
      throw new ValidationError('Sale price must be less than regular price');
    }
    if (request.stockQuantity !== undefined && request.stockQuantity < 0) throw new ValidationError('Stock quantity must be non-negative');
    if (request.rating !== undefined && (request.rating < 0 || request.rating > 5)) throw new ValidationError('Rating must be between 0 and 5');
    if (request.reviewCount !== undefined && request.reviewCount < 0) throw new ValidationError('Review count must be non-negative');

    const updateData: Partial<ProductEntity> = {
      categoryId: request.categoryId,
      name: request.name,
      description: request.description,
      price: request.price,
      salePrice: request.salePrice,
      sku: request.sku,
      images: request.images,
      attributes: request.attributes,
      isActive: request.isActive,
      stockQuantity: request.stockQuantity,
      tags: request.tags,
      rating: request.rating,
      reviewCount: request.reviewCount
    };

    return this.productRepository.update(request.id, updateData);
  }
}
