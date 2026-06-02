import {
  ICategoryRepository,
  CategoryFilters,
} from '../../domain/repositories/ICategoryRepository';
import { CategoryEntity } from '../../domain/entities/Category';
import { PrismaClient } from '@prisma/client';
import { ILogger, LoggerFactory } from '@hbs/logging';
import type { TokenPayload } from '@hbs/auth';
import type { RecordRuleResolver } from '@hbs/authz';
import { assertWriteAccess } from '@hbs/authz';

/**
 * READ ACCESS DECISION (Fase 5.10):
 * Category reads (findAll, findById, findBySlug, findActive, findByName) are intentionally
 * NOT filtered by record rules. Rationale:
 *   1. Categories are storefront catalogue data — anonymous end-users and product resolvers
 *      need unrestricted read access. Breaking this would cascade across the federation.
 *   2. No Category record rules exist in seeds yet; compileDomainExpr would return {} anyway.
 *   3. If tenant-level read restrictions are needed in the future, pass currentUser into
 *      findAll / findById and apply resolveWhere('Category', 'read', currentUser) there.
 * Write/unlink operations DO enforce record rules when a resolver is injected.
 */
export class PrismaCategoryRepository implements ICategoryRepository {
  private readonly logger: ILogger;

  /**
   * @param prisma - Singleton PrismaClient from @hbs/prisma.
   * @param recordRuleResolver - Optional RecordRuleResolver for applying record-level
   *   access rules on write operations (create / update / delete / updateSortOrder).
   *   When absent (e.g. in tests without RBAC), writes are unrestricted.
   */
  constructor(
    private readonly prisma: PrismaClient,
    private readonly recordRuleResolver?: RecordRuleResolver,
  ) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaCategoryRepository');
  }

  async create(category: CategoryEntity, _currentUser?: TokenPayload | null): Promise<CategoryEntity> {
    // Record rules are NOT applied to CREATE. There is no existing row to probe, so
    // assertWriteAccess semantics (probe-by-id) do not apply. Creation is authorised
    // at the resolver level by requireCategoryAdmin (model-level gate). If row-level
    // create restrictions are needed in a future phase, add an explicit domain-expression
    // evaluation here against the incoming data fields (not a row probe).

    try {
      const created = await this.prisma.category.create({
        data: {
          name: category.name,
          description: category.description,
          slug: category.slug,
          image: category.imageUrl,
          isActive: category.isActive,
          sortOrder: category.sortOrder,
        },
      });
      return this.mapToEntity(created);
    } catch (error) {
      this.logger.error(
        'Failed to create category',
        error instanceof Error ? error : new Error(String(error)),
        { name: category.name },
      );
      throw error;
    }
  }

  async findById(id: string): Promise<CategoryEntity | null> {
    try {
      const category = await this.prisma.category.findUnique({ where: { id } });
      return category ? this.mapToEntity(category) : null;
    } catch (error) {
      this.logger.error(
        'Failed to find category by ID',
        error instanceof Error ? error : new Error(String(error)),
        { categoryId: id },
      );
      throw error;
    }
  }

  async findAll(filters?: CategoryFilters): Promise<CategoryEntity[]> {
    try {
      const where: any = {};
      if (filters?.isActive !== undefined) where.isActive = filters.isActive;
      if (filters?.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
      const categories = await this.prisma.category.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        take: filters?.limit,
        skip: filters?.offset,
      });
      return categories.map((c) => this.mapToEntity(c));
    } catch (error) {
      this.logger.error(
        'Failed to find all categories',
        error instanceof Error ? error : new Error(String(error)),
        { filters },
      );
      throw error;
    }
  }

  async findByName(name: string): Promise<CategoryEntity | null> {
    try {
      const category = await this.prisma.category.findUnique({ where: { name } });
      return category ? this.mapToEntity(category) : null;
    } catch (error) {
      this.logger.error(
        'Failed to find category by name',
        error instanceof Error ? error : new Error(String(error)),
        { name },
      );
      throw error;
    }
  }

  async findBySlug(slug: string): Promise<CategoryEntity | null> {
    try {
      const category = await this.prisma.category.findUnique({ where: { slug } });
      return category ? this.mapToEntity(category) : null;
    } catch (error) {
      this.logger.error(
        'Failed to find category by slug',
        error instanceof Error ? error : new Error(String(error)),
        { slug },
      );
      throw error;
    }
  }

  async update(
    id: string,
    categoryData: Partial<CategoryEntity>,
    currentUser?: TokenPayload | null,
  ): Promise<CategoryEntity> {
    // Enforce write-mode record rules before mutating.
    // assertWriteAccess throws NotFoundError (ambiguous 404) when the record does
    // not exist OR when the rule denies access — prevents enumeration oracle.
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Category',
      mode: 'write',
      id,
      currentUser: currentUser ?? null,
      exists: (where) =>
        this.prisma.category
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });

    try {
      const updated = await this.prisma.category.update({
        where: { id },
        data: {
          name: categoryData.name,
          description: categoryData.description,
          slug: categoryData.slug,
          image: categoryData.imageUrl,
          isActive: categoryData.isActive,
          sortOrder: categoryData.sortOrder,
        },
      });
      return this.mapToEntity(updated);
    } catch (error) {
      this.logger.error(
        'Failed to update category',
        error instanceof Error ? error : new Error(String(error)),
        { categoryId: id },
      );
      throw error;
    }
  }

  async delete(id: string, currentUser?: TokenPayload | null): Promise<void> {
    // Enforce unlink-mode record rules before deleting.
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Category',
      mode: 'unlink',
      id,
      currentUser: currentUser ?? null,
      exists: (where) =>
        this.prisma.category
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });

    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      this.logger.error(
        'Failed to delete category',
        error instanceof Error ? error : new Error(String(error)),
        { categoryId: id },
      );
      throw error;
    }
  }

  async findActive(): Promise<CategoryEntity[]> {
    try {
      const categories = await this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      return categories.map((c) => this.mapToEntity(c));
    } catch (error) {
      this.logger.error(
        'Failed to find active categories',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async updateSortOrder(id: string, sortOrder: number, currentUser?: TokenPayload | null): Promise<void> {
    // Enforce write-mode record rules before mutating sort order.
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Category',
      mode: 'write',
      id,
      currentUser: currentUser ?? null,
      exists: (where) =>
        this.prisma.category
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });

    try {
      await this.prisma.category.update({ where: { id }, data: { sortOrder } });
    } catch (error) {
      this.logger.error(
        'Failed to update category sort order',
        error instanceof Error ? error : new Error(String(error)),
        { categoryId: id, sortOrder },
      );
      throw error;
    }
  }

  private mapToEntity(category: any): CategoryEntity {
    return new CategoryEntity(
      category.id,
      category.name,
      category.description,
      category.slug,
      category.image,
      category.isActive,
      category.sortOrder,
      category.createdAt,
      category.updatedAt,
    );
  }
}
