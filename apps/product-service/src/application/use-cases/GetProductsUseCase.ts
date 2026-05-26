import { ProductEntity } from '../../domain/entities/Product';
import { IProductRepository, ProductFilters } from '../../domain/repositories/IProductRepository';

export interface GetProductsRequest {
  filters?: {
    categoryId?: string;
    isActive?: boolean;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    search?: string;
    sku?: string;
  };
  pagination?: {
    limit?: number;
    offset?: number;
  };
}

export interface GetProductsResponse {
  products: ProductEntity[];
  total: number;
  hasMore: boolean;
}

export class GetProductsUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(request: GetProductsRequest = {}): Promise<GetProductsResponse> {
    const pagination = request.pagination || {};
    const limit = pagination.limit || 50;
    const offset = pagination.offset || 0;

    const filters: ProductFilters = {
      categoryId: request.filters?.categoryId,
      isActive: request.filters?.isActive,
      minPrice: request.filters?.minPrice,
      maxPrice: request.filters?.maxPrice,
      inStock: request.filters?.inStock,
      search: request.filters?.search?.trim(),
      sku: request.filters?.sku,
      limit,
      offset
    };

    const products = await this.productRepository.findAll(filters);
    const hasMore = products.length === limit;
    const total = offset + products.length + (hasMore ? 1 : 0);

    return { products, total, hasMore };
  }
}
