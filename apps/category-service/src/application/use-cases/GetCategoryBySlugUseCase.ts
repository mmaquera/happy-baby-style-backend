import { CategoryEntity } from '../../domain/entities/Category';
import { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import { NotFoundError } from '../../domain/errors/DomainError';
import { ILogger, LoggerFactory } from '@hbs/logging';

export interface GetCategoryBySlugRequest {
  slug: string;
}

export class GetCategoryBySlugUseCase {
  private readonly logger: ILogger;

  constructor(private readonly categoryRepository: ICategoryRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetCategoryBySlugUseCase');
  }

  async execute(request: GetCategoryBySlugRequest): Promise<CategoryEntity> {
    try {
      this.logger.info('Starting GetCategoryBySlug use case execution', { slug: request.slug });

      if (!request.slug || request.slug.trim() === '') {
        throw new Error('Category slug is required');
      }

      const category = await this.categoryRepository.findBySlug(request.slug);
      if (!category) {
        this.logger.warn('GetCategoryBySlug failed: category not found', { slug: request.slug });
        throw new NotFoundError('Category', request.slug);
      }

      this.logger.info('GetCategoryBySlug completed', { slug: request.slug, categoryId: category.id });
      return category;

    } catch (error: any) {
      this.logger.error('GetCategoryBySlug use case failed', error, { slug: request.slug });
      throw error;
    }
  }
}
