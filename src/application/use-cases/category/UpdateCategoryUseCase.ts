import { ICategoryRepository } from '@domain/repositories/ICategoryRepository';
import { CategoryEntity } from '@domain/entities/Product';
import { ValidationService } from '@application/validation/ValidationService';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';
import { ILogger } from '@domain/interfaces/ILogger';
import { NotFoundError, DuplicateError, ValidationError } from '@domain/errors/DomainError';

export interface UpdateCategoryRequest {
  id: string;
  name?: string;
  description?: string;
  slug?: string;
  imageUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateCategoryResult {
  category: CategoryEntity;
  changes: string[];
}

export class UpdateCategoryUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly categoryRepository: ICategoryRepository
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateCategoryUseCase');
  }

  async execute(request: UpdateCategoryRequest): Promise<UpdateCategoryResult> {
    const traceId = `update-category-${Date.now()}`;
    
    try {
      this.logger.info('Starting category update process', {
        categoryId: request.id,
        traceId
      });

      // Validar que la categoría existe
      const existingCategory = await this.categoryRepository.findById(request.id);
      if (!existingCategory) {
        this.logger.warn('Category update failed: category not found', {
          categoryId: request.id,
          traceId
        });
        throw new NotFoundError('Category', request.id);
      }

      // Validar input usando el servicio de validación
      this.validateInput(request);

      // Preparar datos para actualización
      const updateData: Partial<CategoryEntity> = {};
      const changes: string[] = [];

      // Validar y procesar cada campo
      if (request.name !== undefined && request.name !== existingCategory.name) {
        // Validar que el nuevo nombre sea único si cambió
        if (request.name !== existingCategory.name) {
          const existingCategoryByName = await this.categoryRepository.findByName(request.name);
          if (existingCategoryByName && existingCategoryByName.id !== request.id) {
            this.logger.warn('Category update failed: name already exists', {
              categoryId: request.id,
              newName: request.name,
              existingCategoryId: existingCategoryByName.id,
              traceId
            });
            throw new DuplicateError('Category', 'name', request.name);
          }
        }
        updateData.name = request.name.trim();
        changes.push('name');
      }

      if (request.description !== undefined && request.description !== existingCategory.description) {
        updateData.description = request.description?.trim();
        changes.push('description');
      }

      if (request.slug !== undefined && request.slug !== existingCategory.slug) {
        // Validar que el nuevo slug sea único si cambió
        if (request.slug !== existingCategory.slug) {
          const existingCategoryBySlug = await this.categoryRepository.findBySlug(request.slug);
          if (existingCategoryBySlug && existingCategoryBySlug.id !== request.id) {
            this.logger.warn('Category update failed: slug already exists', {
              categoryId: request.id,
              newSlug: request.slug,
              existingCategoryId: existingCategoryBySlug.id,
              traceId
            });
            throw new DuplicateError('Category', 'slug', request.slug);
          }
        }
        updateData.slug = request.slug;
        changes.push('slug');
      }

      if (request.imageUrl !== undefined && request.imageUrl !== existingCategory.imageUrl) {
        updateData.imageUrl = request.imageUrl;
        changes.push('imageUrl');
      }

      if (request.isActive !== undefined && request.isActive !== existingCategory.isActive) {
        updateData.isActive = request.isActive;
        changes.push('isActive');
      }

      if (request.sortOrder !== undefined && request.sortOrder !== existingCategory.sortOrder) {
        updateData.sortOrder = request.sortOrder;
        changes.push('sortOrder');
      }

      // Si no hay cambios, retornar la categoría existente
      if (changes.length === 0) {
        this.logger.info('No changes detected for category', {
          categoryId: request.id,
          traceId
        });
        return {
          category: existingCategory,
          changes: []
        };
      }

      this.logger.debug('Updating category with changes', {
        categoryId: request.id,
        changes,
        traceId
      });

      // Actualizar la categoría
      const updatedCategory = await this.categoryRepository.update(request.id, updateData);

      this.logger.info('Category updated successfully', {
        categoryId: request.id,
        changes,
        traceId
      });

      return {
        category: updatedCategory,
        changes
      };

    } catch (error) {
      this.logger.error('Failed to update category', error instanceof Error ? error : new Error(String(error)), {
        categoryId: request.id,
        changes: request,
        traceId
      });
      throw error;
    }
  }

  private validateInput(request: UpdateCategoryRequest): void {
    // Validar ID
    ValidationService.validateRequired('id', request.id);

    // Validar nombre si se proporciona
    if (request.name !== undefined) {
      ValidationService.validateString('name', request.name, {
        minLength: 2,
        maxLength: 100
      });
    }

    // Validar descripción si se proporciona
    if (request.description !== undefined) {
      ValidationService.validateString('description', request.description, {
        maxLength: 500
      });
    }

    // Validar slug si se proporciona
    if (request.slug !== undefined) {
      ValidationService.validateString('slug', request.slug, {
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-z0-9-]+$/
      });
    }

    // Validar URL de imagen si se proporciona
    if (request.imageUrl !== undefined) {
      ValidationService.validateString('imageUrl', request.imageUrl, {
        pattern: /^https?:\/\/.+/
      });
    }

    // Validar orden de clasificación si se proporciona
    if (request.sortOrder !== undefined) {
      ValidationService.validateNumber('sortOrder', request.sortOrder, {
        min: 0,
        max: 999,
        integer: true
      });
    }
  }
}
