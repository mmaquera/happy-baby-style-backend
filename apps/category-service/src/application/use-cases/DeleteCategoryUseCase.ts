import { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import { NotFoundError } from '../../domain/errors/DomainError';
import { ILogger, LoggerFactory } from '@hbs/logging';
import type { TokenPayload } from '@hbs/auth';

export interface DeleteCategoryRequest {
  id: string;
  forceDelete?: boolean;
  /** Authenticated user forwarded to the repository so write-mode record rules are enforced. */
  currentUser?: TokenPayload | null;
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
      this.logger.info('Starting category deletion process', {
        categoryId: request.id,
        forceDelete: request.forceDelete,
        traceId,
      });

      const existingCategory = await this.categoryRepository.findById(request.id);
      if (!existingCategory) {
        throw new NotFoundError('Category', request.id);
      }

      const deletedAt = new Date();
      const softDelete = !request.forceDelete;

      if (softDelete) {
        await this.categoryRepository.update(request.id, { isActive: false }, request.currentUser ?? null);
        this.logger.info('Category soft deleted successfully', { categoryId: request.id, traceId });
      } else {
        await this.categoryRepository.delete(request.id, request.currentUser ?? null);
        this.logger.info('Category hard deleted successfully', { categoryId: request.id, traceId });
      }

      return { id: request.id, deletedAt, softDelete };
    } catch (error) {
      this.logger.error(
        'Failed to delete category',
        error instanceof Error ? error : new Error(String(error)),
        { categoryId: request.id, traceId },
      );
      throw error;
    }
  }
}
