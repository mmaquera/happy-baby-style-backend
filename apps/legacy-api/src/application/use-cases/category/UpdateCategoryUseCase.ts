import { ICategoryRepository } from '@domain/repositories/ICategoryRepository';
import { CategoryEntity } from '@domain/entities/Category';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';
import { ILogger } from '@domain/interfaces/ILogger';
import { NotFoundError, DuplicateError, ValidationError } from '@domain/errors/DomainError';
import { ResponseFactory } from '@hbs/shared-kernel';
import { RESPONSE_CODES } from '@hbs/shared-kernel';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';

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
  success: boolean;
  data?: {
    entity: CategoryEntity;
    id: string;
    updatedAt: Date;
    changes: string[];
  };
  message: string;
  code: string;
  timestamp: string;
  metadata?: {
    requestId?: string;
    traceId?: string;
    duration?: number;
  };
}

export class UpdateCategoryUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly categoryRepository: ICategoryRepository
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateCategoryUseCase');
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'UpdateCategory' }
  })
  async execute(request: UpdateCategoryRequest): Promise<UpdateCategoryResult> {
    const startTime = Date.now();
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

      // Preparar datos para actualización usando un objeto plano
      const updateData: Record<string, any> = {};
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
        
        const duration = Date.now() - startTime;
        return ResponseFactory.createSuccessResponse(
          {
            entity: existingCategory,
            id: existingCategory.id,
            updatedAt: existingCategory.updatedAt,
            changes: []
          },
          'No changes detected for category',
          RESPONSE_CODES.SUCCESS,
          {
            requestId: undefined,
            traceId,
            duration
          }
        ) as UpdateCategoryResult;
      }

      this.logger.debug('Updating category with changes', {
        categoryId: request.id,
        changes,
        traceId
      });

      // Actualizar la categoría
      const updatedCategory = await this.categoryRepository.update(request.id, updateData);

      const duration = Date.now() - startTime;

      this.logger.info('Category updated successfully', {
        categoryId: request.id,
        changes,
        duration,
        traceId
      });

      return ResponseFactory.createSuccessResponse(
        {
          entity: updatedCategory,
          id: updatedCategory.id,
          updatedAt: updatedCategory.updatedAt,
          changes
        },
        'Category updated successfully',
        RESPONSE_CODES.UPDATED,
        {
          requestId: undefined,
          traceId,
          duration
        }
      ) as UpdateCategoryResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Failed to update category', error instanceof Error ? error : new Error(String(error)), {
        categoryId: request.id,
        changes: request,
        duration,
        traceId
      });
      
      // Re-throw para mantener el flujo de errores
      throw error;
    }
  }

  private validateInput(request: UpdateCategoryRequest): void {
    // Validar ID
    this.validateRequired('id', request.id);

    // Validar nombre si se proporciona
    if (request.name !== undefined) {
      this.validateString('name', request.name, {
        minLength: 2,
        maxLength: 100
      });
    }

    // Validar descripción si se proporciona
    if (request.description !== undefined) {
      this.validateString('description', request.description, {
        maxLength: 500
      });
    }

    // Validar slug si se proporciona
    if (request.slug !== undefined) {
      this.validateString('slug', request.slug, {
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-z0-9-]+$/
      });
    }

    // Validar URL de imagen si se proporciona
    if (request.imageUrl !== undefined) {
      this.validateImageUrl('imageUrl', request.imageUrl);
    }

    // Validar orden de clasificación si se proporciona
    if (request.sortOrder !== undefined) {
      this.validateNumber('sortOrder', request.sortOrder, {
        min: 0,
        max: 999,
        integer: true
      });
    }
  }

  // Métodos de validación privados
  private validateRequired(field: string, value: any): void {
    if (value === undefined || value === null || 
        (typeof value === 'string' && value.trim().length === 0)) {
      throw new ValidationError(`Field '${field}' is required`);
    }
  }

  private validateString(field: string, value: any, options?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  }): void {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        throw new ValidationError(`Field '${field}' must be a string`);
      }

      if (options?.minLength && value.length < options.minLength) {
        throw new ValidationError(`Field '${field}' must be at least ${options.minLength} characters long`);
      }

      if (options?.maxLength && value.length > options.maxLength) {
        throw new ValidationError(`Field '${field}' must not exceed ${options.maxLength} characters`);
      }

      if (options?.pattern && !options.pattern.test(value)) {
        throw new ValidationError(`Field '${field}' has an invalid format`);
      }
    }
  }

  private validateNumber(field: string, value: any, options?: {
    min?: number;
    max?: number;
    integer?: boolean;
  }): void {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new ValidationError(`Field '${field}' must be a number`);
      }

      if (options?.integer && !Number.isInteger(value)) {
        throw new ValidationError(`Field '${field}' must be an integer`);
      }

      if (options?.min !== undefined && value < options.min) {
        throw new ValidationError(`Field '${field}' must be at least ${options.min}`);
      }

      if (options?.max !== undefined && value > options.max) {
        throw new ValidationError(`Field '${field}' must not exceed ${options.max}`);
      }
    }
  }

  private validateImageUrl(field: string, value: any): void {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        throw new ValidationError(`Field '${field}' must be a string`);
      }

      if (value.trim().length === 0) {
        throw new ValidationError(`Field '${field}' must not be empty`);
      }

      const trimmedUrl = value.trim();
      
      // Si es una URL absoluta, validar con URL constructor
      if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        try {
          new URL(trimmedUrl);
        } catch {
          throw new ValidationError(`Field '${field}' has an invalid format`);
        }
      } 
      // Si es una ruta relativa, validar que tenga formato válido
      else if (trimmedUrl.startsWith('/')) {
        // Validar que la ruta relativa tenga formato válido
        if (!/^\/[a-zA-Z0-9\/\-_\.]+$/.test(trimmedUrl)) {
          throw new ValidationError(`Field '${field}' has an invalid format`);
        }
      } else {
        throw new ValidationError(`Field '${field}' has an invalid format`);
      }
    }
  }
}
