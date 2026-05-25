import { ProductEntity } from '@domain/entities/Product';
import { IProductRepository } from '@domain/repositories/IProductRepository';
import { ValidationError } from '@domain/errors/DomainError';

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
  constructor(
    private readonly productRepository: IProductRepository
  ) {}

  async execute(request: UpdateProductRequest): Promise<ProductEntity> {
    if (!request.id) {
      throw new Error('Product ID is required');
    }

    // Verificar que el producto existe
    const existingProduct = await this.productRepository.findById(request.id);
    if (!existingProduct) {
      throw new Error('Product not found');
    }

    // Validar SKU único si se está actualizando
    if (request.sku && request.sku !== existingProduct.sku) {
      const existingSku = await this.productRepository.findBySku(request.sku);
      if (existingSku) {
        throw new Error('SKU already exists');
      }
    }

    // Validar precio
    if (request.price !== undefined && request.price < 0) {
      throw new Error('Price must be non-negative');
    }

    if (request.salePrice !== undefined && request.salePrice < 0) {
      throw new Error('Sale price must be non-negative');
    }

    if (request.salePrice !== undefined && request.price !== undefined && request.salePrice >= request.price) {
      throw new Error('Sale price must be less than regular price');
    }

    // Validar stock
    if (request.stockQuantity !== undefined && request.stockQuantity < 0) {
      throw new Error('Stock quantity must be non-negative');
    }

    // Validar rating
    if (request.rating !== undefined && (request.rating < 0 || request.rating > 5)) {
      throw new Error('Rating must be between 0 and 5');
    }

    // Validar review count
    if (request.reviewCount !== undefined && request.reviewCount < 0) {
      throw new Error('Review count must be non-negative');
    }

    // Validar imágenes si se proporcionan
    if (request.images !== undefined) {
      this.validateImages(request.images);
    }

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

    return await this.productRepository.update(request.id, updateData);
  }

  private validateImages(images: string[]): void {
    if (!Array.isArray(images)) {
      throw new ValidationError('Images must be an array');
    }

    if (images.length > 10) {
      throw new ValidationError('Images must not exceed 10 items');
    }

    images.forEach((image, index) => {
      this.validateImageUrl(`images[${index}]`, image);
    });
  }

  private validateImageUrl(field: string, value: any): void {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        throw new ValidationError(`Field '${field}' must be a string`);
      }

      if (value.trim().length === 0) {
        throw new ValidationError(`Field '${field}' must not be empty`);
      }

      const trimmedUrl = value.trim();
      
      // Si es una URL absoluta, validar con URL constructor
      if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        try {
          new URL(trimmedUrl);
        } catch {
          throw new ValidationError(`Field '${field}' has an invalid format`);
        }
      } 
      // Si es una ruta relativa, validar que tenga formato válido
      else if (trimmedUrl.startsWith('/')) {
        // Validar que la ruta relativa tenga formato válido
        if (!/^\/[a-zA-Z0-9\/\-_\.]+$/.test(trimmedUrl)) {
          throw new ValidationError(`Field '${field}' has an invalid format`);
        }
      } else {
        throw new ValidationError(`Field '${field}' has an invalid format`);
      }
    }
  }
} 