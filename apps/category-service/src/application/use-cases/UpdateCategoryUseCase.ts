import { CategoryEntity } from '../../domain/entities/Category';
import { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import { ILogger, LoggerFactory } from '@hbs/logging';
import { NotFoundError, DuplicateError, ValidationError } from '../../domain/errors/DomainError';
import type { TokenPayload } from '@hbs/auth';

export interface UpdateCategoryRequest {
  id: string;
  name?: string;
  description?: string;
  slug?: string;
  imageUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
  /** Authenticated user forwarded to the repository so write-mode record rules are enforced. */
  currentUser?: TokenPayload | null;
}

export interface UpdateCategoryResult {
  entity: CategoryEntity;
  id: string;
  updatedAt: Date;
  changes: string[];
}

export class UpdateCategoryUseCase {
  private readonly logger: ILogger;

  constructor(private readonly categoryRepository: ICategoryRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateCategoryUseCase');
  }

  async execute(request: UpdateCategoryRequest): Promise<UpdateCategoryResult> {
    const traceId = `update-category-${Date.now()}`;

    try {
      this.logger.info('Starting category update process', { categoryId: request.id, traceId });

      const existingCategory = await this.categoryRepository.findById(request.id);
      if (!existingCategory) {
        throw new NotFoundError('Category', request.id);
      }

      this.validateInput(request);

      const updateData: Record<string, any> = {};
      const changes: string[] = [];

      if (request.name !== undefined && request.name !== existingCategory.name) {
        const existingByName = await this.categoryRepository.findByName(request.name);
        if (existingByName && existingByName.id !== request.id) {
          throw new DuplicateError('Category', 'name', request.name);
        }
        updateData.name = request.name.trim();
        changes.push('name');
      }

      if (
        request.description !== undefined &&
        request.description !== existingCategory.description
      ) {
        updateData.description = request.description?.trim();
        changes.push('description');
      }

      if (request.slug !== undefined && request.slug !== existingCategory.slug) {
        const existingBySlug = await this.categoryRepository.findBySlug(request.slug);
        if (existingBySlug && existingBySlug.id !== request.id) {
          throw new DuplicateError('Category', 'slug', request.slug);
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

      if (changes.length === 0) {
        return {
          entity: existingCategory,
          id: existingCategory.id,
          updatedAt: existingCategory.updatedAt,
          changes: [],
        };
      }

      const updatedCategory = await this.categoryRepository.update(
        request.id,
        updateData,
        request.currentUser ?? null,
      );
      this.logger.info('Category updated successfully', {
        categoryId: request.id,
        changes,
        traceId,
      });
      return {
        entity: updatedCategory,
        id: updatedCategory.id,
        updatedAt: updatedCategory.updatedAt,
        changes,
      };
    } catch (error) {
      this.logger.error(
        'Failed to update category',
        error instanceof Error ? error : new Error(String(error)),
        { categoryId: request.id, traceId },
      );
      throw error;
    }
  }

  private validateInput(request: UpdateCategoryRequest): void {
    if (!request.id || request.id.trim().length === 0)
      throw new ValidationError("Field 'id' is required");
    if (request.name !== undefined)
      this.validateStringField('name', request.name, { min: 2, max: 100 });
    if (request.description !== undefined)
      this.validateStringField('description', request.description, { max: 500 });
    if (request.slug !== undefined)
      this.validateStringField('slug', request.slug, { min: 2, max: 100, pattern: /^[a-z0-9-]+$/ });
    if (request.sortOrder !== undefined) {
      if (
        typeof request.sortOrder !== 'number' ||
        isNaN(request.sortOrder) ||
        !Number.isInteger(request.sortOrder)
      )
        throw new ValidationError("Field 'sortOrder' must be an integer");
      if (request.sortOrder < 0 || request.sortOrder > 999)
        throw new ValidationError("Field 'sortOrder' must be between 0 and 999");
    }
  }

  private validateStringField(
    field: string,
    value: any,
    opts?: { min?: number; max?: number; pattern?: RegExp },
  ): void {
    if (typeof value !== 'string') throw new ValidationError(`Field '${field}' must be a string`);
    if (opts?.min && value.length < opts.min)
      throw new ValidationError(`Field '${field}' must be at least ${opts.min} characters`);
    if (opts?.max && value.length > opts.max)
      throw new ValidationError(`Field '${field}' must not exceed ${opts.max} characters`);
    if (opts?.pattern && !opts.pattern.test(value))
      throw new ValidationError(`Field '${field}' has an invalid format`);
  }
}
