import { CategoryEntity } from '../../domain/entities/Category';
import { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import { ILogger, LoggerFactory } from '@hbs/logging';

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

export interface GetCategoriesResult {
  categories: CategoryEntity[];
  total: number;
  hasMore: boolean;
}

export class GetCategoriesUseCase {
  private readonly logger: ILogger;

  constructor(private readonly categoryRepository: ICategoryRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetCategoriesUseCase');
  }

  async execute(request: GetCategoriesRequest = {}): Promise<GetCategoriesResult> {
    try {
      this.logger.info('Starting GetCategories use case execution', {
        filters: request.filters,
        pagination: request.pagination,
      });

      const limit = request.pagination?.limit || 50;
      const offset = request.pagination?.offset || 0;

      const filters = {
        isActive: request.filters?.isActive,
        search: request.filters?.search?.trim(),
        limit,
        offset,
      };

      const categories = await this.categoryRepository.findAll(filters);
      const hasMore = categories.length === limit;
      const total = offset + categories.length + (hasMore ? 1 : 0);

      this.logger.info('GetCategories use case completed', {
        categoriesCount: categories.length,
        total,
        hasMore,
      });
      return { categories, total, hasMore };
    } catch (error: any) {
      this.logger.error('GetCategories use case failed', error, { filters: request.filters });
      throw error;
    }
  }
}
