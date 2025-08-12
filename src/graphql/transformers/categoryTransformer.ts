import { CategoryEntity } from '@domain/entities/Product';

export interface GraphQLCategory {
  id: string;
  name: string;
  description?: string;
  slug: string;
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function transformCategory(category: CategoryEntity): GraphQLCategory {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    slug: category.slug,
    imageUrl: category.imageUrl,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString()
  };
}

export function transformCategories(categories: CategoryEntity[]): GraphQLCategory[] {
  return categories.map(transformCategory);
}
