import { CategoryEntity } from '../../domain/entities/Category';
import { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import {
  RequiredFieldError,
  InvalidFormatError,
  InvalidRangeError,
  DuplicateError,
  BusinessLogicError,
  DatabaseError,
  ValidationError
} from '../../domain/errors/DomainError';
import { ILogger, LoggerFactory } from '@hbs/logging';

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

  constructor(private readonly categoryRepository: ICategoryRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateCategoryUseCase');
  }

  async execute(request: CreateCategoryRequest): Promise<CategoryEntity> {
    const traceId = `create-category-${Date.now()}`;

    try {
      this.logger.info('Starting category creation process', { name: request.name, traceId });
      this.validateInput(request);

      const slug = request.slug || this.generateSlug(request.name);

      const existingByName = await this.categoryRepository.findByName(request.name);
      if (existingByName) {
        this.logger.warn('Category creation failed: name already exists', { name: request.name, traceId });
        throw new DuplicateError('Category', 'name', request.name);
      }

      const existingBySlug = await this.categoryRepository.findBySlug(slug);
      if (existingBySlug) {
        this.logger.warn('Category creation failed: slug already exists', { slug, traceId });
        throw new DuplicateError('Category', 'slug', slug);
      }

      const category = CategoryEntity.create({
        name: request.name.trim(),
        description: request.description?.trim(),
        slug,
        imageUrl: request.imageUrl,
        isActive: request.isActive ?? true,
        sortOrder: request.sortOrder || 0
      });

      const result = await this.categoryRepository.create(category);
      this.logger.info('Category created successfully', { categoryId: result.id, name: result.name, traceId });
      return result;

    } catch (error) {
      if (error instanceof ValidationError || error instanceof DuplicateError || error instanceof BusinessLogicError) {
        this.logger.warn('Category creation failed: business logic error', { name: request.name, error: (error as Error).message, traceId });
        throw error;
      }
      this.logger.error('Category creation failed: infrastructure error', error instanceof Error ? error : new Error(String(error)), { name: request.name, traceId });
      if (error instanceof Error) throw new DatabaseError('create category', error);
      throw new DatabaseError('create category');
    }
  }

  private validateInput(request: CreateCategoryRequest): void {
    if (!request.name || request.name.trim().length === 0) throw new RequiredFieldError('name');
    if (request.name.trim().length < 2 || request.name.trim().length > 100) throw new InvalidRangeError('name', 2, 100);
    if (request.description !== undefined && request.description !== null) {
      if (request.description.trim().length > 500) throw new InvalidRangeError('description', undefined, 500);
    }
    if (request.imageUrl !== undefined && request.imageUrl !== null) {
      const trimmedUrl = request.imageUrl.trim();
      if (trimmedUrl.length === 0) throw new InvalidFormatError('imageUrl', 'non-empty string');
      if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        try { new URL(trimmedUrl); } catch { throw new InvalidFormatError('imageUrl', 'valid URL format'); }
      } else if (trimmedUrl.startsWith('/')) {
        if (!/^\/[a-zA-Z0-9\/\-_\.]+$/.test(trimmedUrl)) throw new InvalidFormatError('imageUrl', 'valid relative path format');
      } else {
        throw new InvalidFormatError('imageUrl', 'valid URL or relative path format');
      }
    }
    if (request.sortOrder !== undefined && request.sortOrder !== null) {
      if (typeof request.sortOrder !== 'number' || !Number.isInteger(request.sortOrder)) throw new InvalidFormatError('sortOrder', 'integer');
      if (request.sortOrder < 0 || request.sortOrder > 999) throw new InvalidRangeError('sortOrder', 0, 999);
    }
  }

  private generateSlug(name: string): string {
    return name.toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
