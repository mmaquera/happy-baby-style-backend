import { CategoryEntity } from '@domain/entities/Product';
import { ICategoryRepository } from '@domain/repositories/ICategoryRepository';
import { 
  RequiredFieldError, 
  InvalidFormatError, 
  InvalidRangeError,
  DuplicateError, 
  BusinessLogicError,
  DatabaseError,
  ValidationError 
} from '@domain/errors/DomainError';
import { ILogger } from '@domain/interfaces/ILogger';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  slug?: string;
  imageUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export class CreateCategoryUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly categoryRepository: ICategoryRepository
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateCategoryUseCase');
  }

  async execute(request: CreateCategoryRequest): Promise<CategoryEntity> {
    const traceId = `create-category-${Date.now()}`;
    
    try {
      this.logger.info('Starting category creation process', {
        name: request.name,
        traceId
      });

      // Validación de input usando el servicio de validación
      this.validateInput(request);

      // Generar slug si no se proporciona
      const slug = request.slug || this.generateSlug(request.name);

      // Validar que el nombre sea único
      const existingCategoryByName = await this.categoryRepository.findByName(request.name);
      if (existingCategoryByName) {
        this.logger.warn('Category creation failed: name already exists', {
          name: request.name,
          existingCategoryId: existingCategoryByName.id,
          traceId
        });
        throw new DuplicateError('Category', 'name', request.name);
      }

      // Validar que el slug sea único
      const existingCategoryBySlug = await this.categoryRepository.findBySlug(slug);
      if (existingCategoryBySlug) {
        this.logger.warn('Category creation failed: slug already exists', {
          slug,
          existingCategoryId: existingCategoryBySlug.id,
          traceId
        });
        throw new DuplicateError('Category', 'slug', slug);
      }

      // Crear categoría
      const category = CategoryEntity.create({
        name: request.name.trim(),
        description: request.description?.trim(),
        slug,
        imageUrl: request.imageUrl,
        isActive: request.isActive ?? true,
        sortOrder: request.sortOrder || 0
      });

      this.logger.debug('Category entity created, saving to repository', {
        categoryId: category.id,
        name: category.name,
        slug: category.slug,
        traceId
      });

      const result = await this.categoryRepository.create(category);

      this.logger.info('Category created successfully', {
        categoryId: result.id,
        name: result.name,
        slug: result.slug,
        traceId
      });

      return result;

    } catch (error) {
      // Re-throw validation and domain errors as-is
      if (error instanceof ValidationError || 
          error instanceof DuplicateError || 
          error instanceof BusinessLogicError) {
        this.logger.warn('Category creation failed: business logic error', {
          name: request.name,
          error: error.message,
          traceId
        });
        throw error;
      }
      
      // Wrap infrastructure errors
      this.logger.error('Category creation failed: infrastructure error', error instanceof Error ? error : new Error(String(error)), {
        name: request.name,
        traceId
      });
      
      if (error instanceof Error) {
        throw new DatabaseError('create category', error);
      }
      
      throw new DatabaseError('create category');
    }
  }

  private validateInput(request: CreateCategoryRequest): void {
    // Validación del nombre
    if (!request.name || request.name.trim().length === 0) {
      throw new RequiredFieldError('name');
    }
    
    if (request.name.trim().length < 2 || request.name.trim().length > 100) {
      throw new InvalidRangeError('name', 2, 100);
    }

    // Validación de la descripción
    if (request.description !== undefined && request.description !== null) {
      if (request.description.trim().length > 500) {
        throw new InvalidRangeError('description', undefined, 500);
      }
    }

    // Validación de la URL de imagen
    if (request.imageUrl !== undefined && request.imageUrl !== null) {
      if (request.imageUrl.trim().length === 0) {
        throw new InvalidFormatError('imageUrl', 'non-empty string');
      }
      
      // Basic URL validation
      try {
        new URL(request.imageUrl);
      } catch {
        throw new InvalidRangeError('imageUrl', undefined, undefined);
      }
    }

    // Validación del orden de clasificación
    if (request.sortOrder !== undefined && request.sortOrder !== null) {
      if (typeof request.sortOrder !== 'number' || !Number.isInteger(request.sortOrder)) {
        throw new InvalidFormatError('sortOrder', 'integer');
      }
      
      if (request.sortOrder < 0 || request.sortOrder > 999) {
        throw new InvalidRangeError('sortOrder', 0, 999);
      }
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }
}
