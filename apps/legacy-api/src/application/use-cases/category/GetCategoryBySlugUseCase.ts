import { CategoryEntity } from '@domain/entities/Product';
import { ICategoryRepository } from '@domain/repositories/ICategoryRepository';
import { NotFoundError } from '@domain/errors/DomainError';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';
import { ILogger } from '@domain/interfaces/ILogger';

export interface GetCategoryBySlugRequest {
  slug: string;
}

export class GetCategoryBySlugUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly categoryRepository: ICategoryRepository
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetCategoryBySlugUseCase');
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'GetCategoryBySlug' }
  })
  async execute(request: GetCategoryBySlugRequest): Promise<CategoryEntity> {
    try {
      this.logger.info('Starting GetCategoryBySlug use case execution', {
        slug: request.slug
      });

      if (!request.slug || request.slug.trim() === '') {
        this.logger.warn('GetCategoryBySlug failed: invalid slug', {
          slug: request.slug
        });
        throw new Error('Category slug is required');
      }

      const category = await this.categoryRepository.findBySlug(request.slug);

      if (!category) {
        this.logger.warn('GetCategoryBySlug failed: category not found', {
          slug: request.slug
        });
        throw new NotFoundError('Category', request.slug);
      }

      this.logger.info('GetCategoryBySlug use case completed successfully', {
        slug: request.slug,
        categoryId: category.id,
        categoryName: category.name
      });

      return category;
    } catch (error: any) {
      this.logger.error('GetCategoryBySlug use case failed', error, {
        slug: request.slug
      });
      throw error;
    }
  }
}
