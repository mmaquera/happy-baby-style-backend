import { CategoryEntity } from '@domain/entities/Product';
import { ICategoryRepository } from '@domain/repositories/ICategoryRepository';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';
import { ILogger } from '@domain/interfaces/ILogger';

export interface GetCategoriesRequest {
  filters?: {
    isActive?: boolean;
    search?: string;
  };
  pagination?: {
    limit?: number;
    offset?: number;
  };
}

export interface GetCategoriesResponse {
  categories: CategoryEntity[];
  total: number;
  hasMore: boolean;
}

export class GetCategoriesUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly categoryRepository: ICategoryRepository
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetCategoriesUseCase');
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'GetCategories' }
  })
  async execute(request: GetCategoriesRequest = {}): Promise<GetCategoriesResponse> {
    try {
      this.logger.info('Starting GetCategories use case execution', {
        filters: request.filters,
        pagination: request.pagination
      });

      const pagination = request.pagination || {};
      const limit = pagination.limit || 50;
      const offset = pagination.offset || 0;
      
      const filters = {
        isActive: request.filters?.isActive,
        search: request.filters?.search?.trim(),
        limit,
        offset
      };

      this.logger.debug('Applying filters to category query', { filters });

      const categories = await this.categoryRepository.findAll(filters);
      
      // Note: This is a simplified implementation. 
      // For production, you'd want to get the actual total count from the database
      const hasMore = categories.length === limit;
      const total = offset + categories.length + (hasMore ? 1 : 0);

      const result = {
        categories,
        total,
        hasMore
      };

      this.logger.info('GetCategories use case completed successfully', {
        categoriesCount: categories.length,
        total,
        hasMore,
        filters: request.filters
      });

      return result;
    } catch (error: any) {
      this.logger.error('GetCategories use case failed', error, {
        filters: request.filters,
        pagination: request.pagination
      });
      throw error;
    }
  }
}
