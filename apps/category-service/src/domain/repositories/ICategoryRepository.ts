import { CategoryEntity } from '../entities/Category';
import type { TokenPayload } from '@hbs/auth';

export interface CategoryFilters {
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ICategoryRepository {
  /** currentUser is used by implementations that enforce write-side record rules. */
  create(category: CategoryEntity, currentUser?: TokenPayload | null): Promise<CategoryEntity>;
  findById(id: string): Promise<CategoryEntity | null>;
  findAll(filters?: CategoryFilters): Promise<CategoryEntity[]>;
  findByName(name: string): Promise<CategoryEntity | null>;
  findBySlug(slug: string): Promise<CategoryEntity | null>;
  /** currentUser is used by implementations that enforce write-side record rules. */
  update(id: string, category: Partial<CategoryEntity>, currentUser?: TokenPayload | null): Promise<CategoryEntity>;
  /** currentUser is used by implementations that enforce write-side record rules. */
  delete(id: string, currentUser?: TokenPayload | null): Promise<void>;
  findActive(): Promise<CategoryEntity[]>;
  /** currentUser is used by implementations that enforce write-side record rules. */
  updateSortOrder(id: string, sortOrder: number, currentUser?: TokenPayload | null): Promise<void>;

  // ---------------------------------------------------------------------------
  // Hierarchy (adjacency-list) — added in 0002_category_parent_hierarchy
  // ---------------------------------------------------------------------------

  /**
   * Returns all direct children of a parent category (depth = 1).
   * Backed by the index on categories.parent_id.
   * Use for: subcategory listing, tree node expansion.
   */
  findChildren(parentId: string): Promise<CategoryEntity[]>;

  /**
   * Returns all root categories (parent_id IS NULL).
   * Use for: top-level navigation, tree root rendering.
   */
  findRoots(): Promise<CategoryEntity[]>;

  /**
   * Alias for findChildren kept for symmetry with common query naming.
   * Implementations may delegate directly to findChildren.
   */
  findByParentId(parentId: string): Promise<CategoryEntity[]>;

  /**
   * Returns the ancestor chain for a given category, ordered from root down
   * to the immediate parent of `id` (i.e. the breadcrumb path, excluding `id` itself).
   *
   * IMPLEMENTATION NOTE for backend-expert:
   *   Preferred approach — single recursive CTE:
   *
   *     WITH RECURSIVE ancestors AS (
   *       SELECT c.*
   *       FROM categories c
   *       WHERE c.id = (SELECT parent_id FROM categories WHERE id = $id)
   *       UNION ALL
   *       SELECT c.*
   *       FROM categories c
   *       JOIN ancestors a ON c.id = a.parent_id
   *     )
   *     SELECT * FROM ancestors ORDER BY ... ;
   *
   *   This is O(depth) in one round-trip.
   *
   *   Alternative (simpler, acceptable for shallow trees ≤ 4 levels):
   *   N sequential findById() calls up the parent chain — O(depth) round-trips.
   *   For typical product-catalog trees (depth 2–4) this is acceptable,
   *   but the CTE variant is strictly better for deep hierarchies.
   *
   *   Raw SQL via prisma.$queryRaw is required for the CTE — Prisma does not
   *   generate recursive CTEs from its query builder.
   *
   * Returns an ordered array [root, ..., directParent].
   * Returns empty array if `id` is already a root.
   */
  findAncestors(id: string): Promise<CategoryEntity[]>;
}
