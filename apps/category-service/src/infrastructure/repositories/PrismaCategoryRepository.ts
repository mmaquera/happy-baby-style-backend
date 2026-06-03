import {
  ICategoryRepository,
  CategoryFilters,
} from '../../domain/repositories/ICategoryRepository';
import { CategoryEntity } from '../../domain/entities/Category';
import { PrismaClient } from '../../prisma';
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
          parentId: category.parentId ?? null,
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
          // Only set parentId when explicitly provided in the patch (including null to detach)
          ...('parentId' in categoryData ? { parentId: categoryData.parentId ?? null } : {}),
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

  // ---------------------------------------------------------------------------
  // Hierarchy methods — implemented in Ola 2
  // ---------------------------------------------------------------------------

  /**
   * Returns direct children of a parent (depth = 1).
   * Backed by the index on categories.parent_id.
   */
  async findChildren(parentId: string): Promise<CategoryEntity[]> {
    try {
      const categories = await this.prisma.category.findMany({
        where: { parentId },
        orderBy: { sortOrder: 'asc' },
      });
      return categories.map((c) => this.mapToEntity(c));
    } catch (error) {
      this.logger.error(
        'Failed to find children for category',
        error instanceof Error ? error : new Error(String(error)),
        { parentId },
      );
      throw error;
    }
  }

  /**
   * Returns all root categories (parentId IS NULL).
   */
  async findRoots(): Promise<CategoryEntity[]> {
    try {
      const categories = await this.prisma.category.findMany({
        where: { parentId: null },
        orderBy: { sortOrder: 'asc' },
      });
      return categories.map((c) => this.mapToEntity(c));
    } catch (error) {
      this.logger.error(
        'Failed to find root categories',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Alias for findChildren — kept for interface symmetry.
   */
  async findByParentId(parentId: string): Promise<CategoryEntity[]> {
    return this.findChildren(parentId);
  }

  /**
   * Returns the ancestor chain for a given category, ordered [root, …, directParent].
   *
   * Implementation choice — recursive CTE via prisma.$queryRaw:
   *   O(depth) in a single round-trip. This is strictly better than N sequential
   *   findById() calls even for shallow trees (depth 2–4), because it avoids N
   *   separate round-trips and keeps the breadcrumb query atomic.
   *
   * The CTE walks upward from the immediate parent of `id` until it reaches a
   * root node (parent_id IS NULL), accumulating depth so we can ORDER BY depth
   * descending to produce [root → directParent] order.
   *
   * Returns [] if `id` is already a root (parentId IS NULL).
   */
  async findAncestors(id: string): Promise<CategoryEntity[]> {
    try {
      // Raw SQL required — Prisma's query builder does not support recursive CTEs.
      //
      // Column naming rules for $queryRaw:
      //   - SELECT must use actual DB column names (snake_case, per Prisma @map directives).
      //   - AS aliases are used to expose camelCase names so the shared mapToEntity helper
      //     can process both Prisma-ORM results and raw-SQL results uniformly.
      //   - Quoted identifiers in WHERE/JOIN must also use snake_case DB column names.
      //
      // The CTE walks upward from the immediate parent of `id`, accumulates depth so
      // we can ORDER BY depth DESC to produce [root → directParent] ordering.
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          description: string | null;
          slug: string;
          image: string | null;
          isActive: boolean;
          sortOrder: number;
          createdAt: Date;
          updatedAt: Date;
          parentId: string | null;
          depth: number;
        }>
      >`
        WITH RECURSIVE ancestors AS (
          -- Anchor: start from the immediate parent of the requested category.
          -- Uses snake_case DB column names; AS aliases expose camelCase for mapToEntity.
          SELECT
            c.id,
            c.name,
            c.description,
            c.slug,
            c.image,
            c.is_active    AS "isActive",
            c.sort_order   AS "sortOrder",
            c.created_at   AS "createdAt",
            c.updated_at   AS "updatedAt",
            c.parent_id    AS "parentId",
            1              AS depth
          FROM categories c
          WHERE c.id = (SELECT parent_id FROM categories WHERE id = ${id})
            AND (SELECT parent_id FROM categories WHERE id = ${id}) IS NOT NULL

          UNION ALL

          -- Recursive step: walk up the tree one level at a time.
          SELECT
            c.id,
            c.name,
            c.description,
            c.slug,
            c.image,
            c.is_active    AS "isActive",
            c.sort_order   AS "sortOrder",
            c.created_at   AS "createdAt",
            c.updated_at   AS "updatedAt",
            c.parent_id    AS "parentId",
            a.depth + 1
          FROM categories c
          JOIN ancestors a ON c.id = a."parentId"
        )
        SELECT * FROM ancestors ORDER BY depth DESC
      `;

      return rows.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error(
        'Failed to find ancestors for category',
        error instanceof Error ? error : new Error(String(error)),
        { categoryId: id },
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
      category.parentId ?? null,
    );
  }
}
