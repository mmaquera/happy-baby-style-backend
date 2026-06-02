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
}
