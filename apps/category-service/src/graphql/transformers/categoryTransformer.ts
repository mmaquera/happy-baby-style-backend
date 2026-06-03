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
  /**
   * Flat parent ID exposed so clients can reference the parent without
   * triggering the lazy `parent` field resolver. Maps to `CategoryEntity.parentId`.
   */
  parentCategoryId?: string | null;
  /**
   * Lazy field — resolved by the Category.parent field resolver only when requested.
   * Never eagerly populated by transformCategory; the resolver fetches it on demand.
   */
  parent?: GraphQLCategory | null;
  /**
   * Lazy field — resolved by the Category.children field resolver only when requested.
   * Never eagerly populated by transformCategory; the resolver fetches them on demand.
   */
  children?: GraphQLCategory[];
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
    updatedAt: category.updatedAt.toISOString(),
    parentCategoryId: category.parentId ?? null,
    // parent and children are intentionally omitted here.
    // They are resolved lazily via Category field resolvers only when
    // the client explicitly requests them. This prevents N+1 on list queries.
  };
}

export function transformCategories(categories: CategoryEntity[]): GraphQLCategory[] {
  return categories.map(transformCategory);
}
