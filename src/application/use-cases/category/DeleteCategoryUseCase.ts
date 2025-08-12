import { ICategoryRepository } from '@domain/repositories/ICategoryRepository';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';
import { ILogger } from '@domain/interfaces/ILogger';
import { NotFoundError, BusinessLogicError } from '@domain/errors/DomainError';

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

  constructor(
    private readonly categoryRepository: ICategoryRepository
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteCategoryUseCase');
  }

  async execute(request: DeleteCategoryRequest): Promise<DeleteCategoryResult> {
    const traceId = `delete-category-${Date.now()}`;
    
    try {
      this.logger.info('Starting category deletion process', {
        categoryId: request.id,
        forceDelete: request.forceDelete,
        traceId
      });

      // Validar que la categoría existe
      const existingCategory = await this.categoryRepository.findById(request.id);
      if (!existingCategory) {
        this.logger.warn('Category deletion failed: category not found', {
          categoryId: request.id,
          traceId
        });
        throw new NotFoundError('Category', request.id);
      }

      // Verificar si la categoría tiene productos asociados
      // Nota: Esto requeriría una implementación adicional en el repositorio
      // Por ahora, asumimos que no hay productos asociados
      
      const deletedAt = new Date();
      const softDelete = !request.forceDelete;

      if (softDelete) {
        // Soft delete: marcar como inactiva
        this.logger.debug('Performing soft delete for category', {
          categoryId: request.id,
          traceId
        });

        await this.categoryRepository.update(request.id, {
          isActive: false,
          // Podríamos agregar campos como deletedAt, deletedBy, etc.
        });

        this.logger.info('Category soft deleted successfully', {
          categoryId: request.id,
          traceId
        });
      } else {
        // Hard delete: eliminar completamente
        this.logger.debug('Performing hard delete for category', {
          categoryId: request.id,
          traceId
        });

        await this.categoryRepository.delete(request.id);

        this.logger.info('Category hard deleted successfully', {
          categoryId: request.id,
          traceId
        });
      }

      return {
        id: request.id,
        deletedAt,
        softDelete
      };

    } catch (error) {
      this.logger.error('Failed to delete category', error instanceof Error ? error : new Error(String(error)), {
        categoryId: request.id,
        forceDelete: request.forceDelete,
        traceId
      });
      throw error;
    }
  }
}
