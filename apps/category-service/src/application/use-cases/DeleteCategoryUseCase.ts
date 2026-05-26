import { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import { NotFoundError } from '../../domain/errors/DomainError';
import { ILogger, LoggerFactory } from '@hbs/logging';

export interface DeleteCategoryRequest {
  id: string;
  forceDelete?: boolean;
}

export interface DeleteCategoryResult {
  id: string;
  deletedAt: Date;
  softDelete: boolean;
}

export class DeleteCategoryUseCase {
  private readonly logger: ILogger;

  constructor(private readonly categoryRepository: ICategoryRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteCategoryUseCase');
  }

  async execute(request: DeleteCategoryRequest): Promise<DeleteCategoryResult> {
    const traceId = `delete-category-${Date.now()}`;

    try {
      this.logger.info('Starting category deletion process', { categoryId: request.id, forceDelete: request.forceDelete, traceId });

      const existingCategory = await this.categoryRepository.findById(request.id);
      if (!existingCategory) {
        throw new NotFoundError('Category', request.id);
      }

      const deletedAt = new Date();
      const softDelete = !request.forceDelete;

      if (softDelete) {
        await this.categoryRepository.update(request.id, { isActive: false });
        this.logger.info('Category soft deleted successfully', { categoryId: request.id, traceId });
      } else {
        await this.categoryRepository.delete(request.id);
        this.logger.info('Category hard deleted successfully', { categoryId: request.id, traceId });
      }

      return { id: request.id, deletedAt, softDelete };

    } catch (error) {
      this.logger.error('Failed to delete category', error instanceof Error ? error : new Error(String(error)), { categoryId: request.id, traceId });
      throw error;
    }
  }
}
