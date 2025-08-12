import { CategoryEntity } from '@domain/entities/Product';
import { ICategoryRepository } from '@domain/repositories/ICategoryRepository';
import { NotFoundError } from '@domain/errors/DomainError';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';
import { ILogger } from '@domain/interfaces/ILogger';

export interface GetCategoryByIdRequest {
  id: string;
}

export class GetCategoryByIdUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly categoryRepository: ICategoryRepository
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetCategoryByIdUseCase');
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'GetCategoryById' }
  })
  async execute(request: GetCategoryByIdRequest): Promise<CategoryEntity> {
    try {
      this.logger.info('Starting GetCategoryById use case execution', {
        categoryId: request.id
      });

      if (!request.id || request.id.trim() === '') {
        this.logger.warn('GetCategoryById failed: invalid category ID', {
          categoryId: request.id
        });
        throw new Error('Category ID is required');
      }

      const category = await this.categoryRepository.findById(request.id);

      if (!category) {
        this.logger.warn('GetCategoryById failed: category not found', {
          categoryId: request.id
        });
        throw new NotFoundError('Category', request.id);
      }

      this.logger.info('GetCategoryById use case completed successfully', {
        categoryId: request.id,
        categoryName: category.name
      });

      return category;
    } catch (error: any) {
      this.logger.error('GetCategoryById use case failed', error, {
        categoryId: request.id
      });
      throw error;
    }
  }
}
