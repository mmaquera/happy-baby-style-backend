import { CategoryEntity } from '../../domain/entities/Category';

function buildImageUrl(imagePath: string | undefined): string | undefined {
  if (!imagePath) return undefined;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  const base = (process.env.STORAGE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
  const clean = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  return `${base}/${clean}`;
}

export interface GraphQLCategory {
  id: string;
  name: string;
  description?: string;
  slug: string;
  image?: string;
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
    image: buildImageUrl(category.imageUrl),
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString()
  };
}

export function transformCategories(categories: CategoryEntity[]): GraphQLCategory[] {
  return categories.map(transformCategory);
}
