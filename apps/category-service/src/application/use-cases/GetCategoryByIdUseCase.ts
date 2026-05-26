import { CategoryEntity } from '../../domain/entities/Category';
import { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import { NotFoundError } from '../../domain/errors/DomainError';
import { ILogger, LoggerFactory } from '@hbs/logging';

export interface GetCategoryByIdRequest {
  id: string;
}

export class GetCategoryByIdUseCase {
  private readonly logger: ILogger;

  constructor(private readonly categoryRepository: ICategoryRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetCategoryByIdUseCase');
  }

  async execute(request: GetCategoryByIdRequest): Promise<CategoryEntity> {
    try {
      this.logger.info('Starting GetCategoryById use case execution', { categoryId: request.id });

      if (!request.id || request.id.trim() === '') {
        throw new Error('Category ID is required');
      }

      const category = await this.categoryRepository.findById(request.id);
      if (!category) {
        this.logger.warn('GetCategoryById failed: category not found', { categoryId: request.id });
        throw new NotFoundError('Category', request.id);
      }

      this.logger.info('GetCategoryById completed', {
        categoryId: request.id,
        categoryName: category.name,
      });
      return category;
    } catch (error: any) {
      this.logger.error('GetCategoryById use case failed', error, { categoryId: request.id });
      throw error;
    }
  }
}
