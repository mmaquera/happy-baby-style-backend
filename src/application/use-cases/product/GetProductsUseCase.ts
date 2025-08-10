import { ProductEntity } from '@domain/entities/Product';
import { IProductRepository, ProductFilters } from '@domain/repositories/IProductRepository';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';
import { ILogger } from '@domain/interfaces/ILogger';

export interface GetProductsRequest {
  filters?: {
    category?: string;
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
  private readonly logger: ILogger;

  constructor(
    private readonly productRepository: IProductRepository
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetProductsUseCase');
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'GetProducts' }
  })
  async execute(request: GetProductsRequest = {}): Promise<GetProductsResponse> {
    try {
      this.logger.info('Starting GetProducts use case execution', {
        filters: request.filters,
        pagination: request.pagination
      });

      const pagination = request.pagination || {};
      const limit = pagination.limit || 50;
      const offset = pagination.offset || 0;
      
      const filters: ProductFilters = {
        categoryId: request.filters?.category,
        isActive: request.filters?.isActive,
        minPrice: request.filters?.minPrice,
        maxPrice: request.filters?.maxPrice,
        inStock: request.filters?.inStock,
        search: request.filters?.search?.trim(),
        sku: request.filters?.sku,
        limit,
        offset
      };

      this.logger.debug('Applying filters to product query', { filters });

      const products = await this.productRepository.findAll(filters);
      
      // Note: This is a simplified implementation. 
      // For production, you'd want to get the actual total count from the database
      const hasMore = products.length === limit;
      const total = offset + products.length + (hasMore ? 1 : 0);

      const result = {
        products,
        total,
        hasMore
      };

      this.logger.info('GetProducts use case completed successfully', {
        productsCount: products.length,
        total,
        hasMore,
        filters: request.filters
      });

      return result;
    } catch (error: any) {
      this.logger.error('GetProducts use case failed', error, {
        filters: request.filters,
        pagination: request.pagination
      });
      throw error;
    }
  }
}