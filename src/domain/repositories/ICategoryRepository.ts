import { CategoryEntity } from '../entities/Product';

export interface CategoryFilters {
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ICategoryRepository {
  create(category: CategoryEntity): Promise<CategoryEntity>;
  findById(id: string): Promise<CategoryEntity | null>;
  findAll(filters?: CategoryFilters): Promise<CategoryEntity[]>;
  findByName(name: string): Promise<CategoryEntity | null>;
  findBySlug(slug: string): Promise<CategoryEntity | null>;
  update(id: string, category: Partial<CategoryEntity>): Promise<CategoryEntity>;
  delete(id: string): Promise<void>;
  findActive(): Promise<CategoryEntity[]>;
  updateSortOrder(id: string, sortOrder: number): Promise<void>;
}
