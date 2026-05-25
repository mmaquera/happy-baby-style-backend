import { ICategoryRepository, CategoryFilters } from '@domain/repositories/ICategoryRepository';
import { CategoryEntity } from '@domain/entities/Product';
import { PrismaClient } from '@prisma/client';
import { ILogger } from '@domain/interfaces/ILogger';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';

export class PrismaCategoryRepository implements ICategoryRepository {
  private readonly logger: ILogger;

  constructor(private prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaCategoryRepository');
  }

  async create(category: CategoryEntity): Promise<CategoryEntity> {
    const traceId = `create-category-${Date.now()}`;
    
    try {
      this.logger.debug('Creating category', {
        name: category.name,
        slug: category.slug,
        traceId
      });

      const createdCategory = await this.prisma.category.create({
        data: {
          name: category.name,
          description: category.description,
          slug: category.slug,
          image: category.imageUrl,
          isActive: category.isActive,
          sortOrder: category.sortOrder
        }
      });

      const result = this.mapToCategoryEntity(createdCategory);
      
      this.logger.info('Category created successfully', {
        categoryId: result.id,
        name: result.name,
        traceId
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create category', error instanceof Error ? error : new Error(String(error)), {
        name: category.name,
        slug: category.slug,
        traceId
      });
      throw error;
    }
  }

  async findById(id: string): Promise<CategoryEntity | null> {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id }
      });

      return category ? this.mapToCategoryEntity(category) : null;
    } catch (error) {
      this.logger.error('Failed to find category by ID', error instanceof Error ? error : new Error(String(error)), {
        categoryId: id
      });
      throw error;
    }
  }

  async findAll(filters?: CategoryFilters): Promise<CategoryEntity[]> {
    try {
      const where: any = {};
      
      // Aplicar filtros
      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }
      
      if (filters?.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      const categories = await this.prisma.category.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        take: filters?.limit,
        skip: filters?.offset
      });

      return categories.map(category => this.mapToCategoryEntity(category));
    } catch (error) {
      this.logger.error('Failed to find all categories', error instanceof Error ? error : new Error(String(error)), {
        filters
      });
      throw error;
    }
  }

  async findByName(name: string): Promise<CategoryEntity | null> {
    try {
      const category = await this.prisma.category.findUnique({
        where: { name }
      });

      return category ? this.mapToCategoryEntity(category) : null;
    } catch (error) {
      this.logger.error('Failed to find category by name', error instanceof Error ? error : new Error(String(error)), {
        name
      });
      throw error;
    }
  }

  async findBySlug(slug: string): Promise<CategoryEntity | null> {
    try {
      const category = await this.prisma.category.findUnique({
        where: { slug }
      });

      return category ? this.mapToCategoryEntity(category) : null;
    } catch (error) {
      this.logger.error('Failed to find category by slug', error instanceof Error ? error : new Error(String(error)), {
        slug
      });
      throw error;
    }
  }

  async update(id: string, categoryData: Partial<CategoryEntity>): Promise<CategoryEntity> {
    const traceId = `update-category-${Date.now()}`;
    
    try {
      this.logger.debug('Updating category', {
        categoryId: id,
        changes: Object.keys(categoryData),
        traceId
      });

      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: {
          name: categoryData.name,
          description: categoryData.description,
          slug: categoryData.slug,
          image: categoryData.imageUrl,
          isActive: categoryData.isActive,
          sortOrder: categoryData.sortOrder
        }
      });

      const result = this.mapToCategoryEntity(updatedCategory);
      
      this.logger.info('Category updated successfully', {
        categoryId: id,
        name: result.name,
        traceId
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to update category', error instanceof Error ? error : new Error(String(error)), {
        categoryId: id,
        traceId
      });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const traceId = `delete-category-${Date.now()}`;
    
    try {
      this.logger.debug('Deleting category', {
        categoryId: id,
        traceId
      });

      await this.prisma.category.delete({
        where: { id }
      });

      this.logger.info('Category deleted successfully', {
        categoryId: id,
        traceId
      });
    } catch (error) {
      this.logger.error('Failed to delete category', error instanceof Error ? error : new Error(String(error)), {
        categoryId: id,
        traceId
      });
      throw error;
    }
  }

  async findActive(): Promise<CategoryEntity[]> {
    try {
      const categories = await this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      });

      return categories.map(category => this.mapToCategoryEntity(category));
    } catch (error) {
      this.logger.error('Failed to find active categories', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async updateSortOrder(id: string, sortOrder: number): Promise<void> {
    try {
      await this.prisma.category.update({
        where: { id },
        data: { sortOrder }
      });

      this.logger.debug('Category sort order updated', {
        categoryId: id,
        newSortOrder: sortOrder
      });
    } catch (error) {
      this.logger.error('Failed to update category sort order', error instanceof Error ? error : new Error(String(error)), {
        categoryId: id,
        sortOrder
      });
      throw error;
    }
  }

  private mapToCategoryEntity(category: any): CategoryEntity {
    return new CategoryEntity(
      category.id,
      category.name,
      category.description,
      category.slug,
      category.image,
      category.isActive,
      category.sortOrder,
      category.createdAt,
      category.updatedAt
    );
  }
}
