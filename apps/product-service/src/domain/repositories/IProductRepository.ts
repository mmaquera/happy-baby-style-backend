import type { TokenPayload } from '@hbs/auth';
import { ProductEntity, ProductVariantEntity } from '../entities/Product';

export interface ProductFilters {
  categoryId?: string;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  search?: string;
  sku?: string;
  limit?: number;
  offset?: number;
}

export interface IProductRepository {
  create(product: ProductEntity): Promise<ProductEntity>;
  /** Public catalog read — no user context required. */
  findById(id: string): Promise<ProductEntity | null>;
  /** Bypasses record-rule filters. For internal callers (event consumers) only. */
  findByIdUnrestricted(id: string): Promise<ProductEntity | null>;
  findAll(filters?: ProductFilters): Promise<ProductEntity[]>;
  /**
   * Probes write/unlink access for a product BEFORE any business validation runs.
   * Use at the very start of any mutating use case to prevent leaking existence
   * information through subsequent validation errors (e.g. SKU conflict).
   * Throws NotFoundError (ambiguous 404) when access is denied or record missing.
   */
  ensureWritable(id: string, mode: 'write' | 'unlink', currentUser: TokenPayload | null): Promise<void>;
  /** currentUser is required for record-rule enforcement on write paths. */
  update(id: string, product: Partial<ProductEntity>, currentUser: TokenPayload | null): Promise<ProductEntity>;
  /** currentUser is required for record-rule enforcement on unlink paths. */
  delete(id: string, currentUser: TokenPayload | null): Promise<void>;
  findByCategory(categoryId: string): Promise<ProductEntity[]>;
  findBySku(sku: string): Promise<ProductEntity | null>;
  updateStock(id: string, stockQuantity: number): Promise<void>;
  search(query: string): Promise<ProductEntity[]>;

  /**
   * Returns products with stockQuantity > 0 AND <= threshold, filtered in DB (no full scan).
   * Default threshold = 10 matches the legacy in-memory filter.
   */
  findLowStock(threshold?: number): Promise<ProductEntity[]>;

  /**
   * Returns active products with stockQuantity = 0, filtered in DB (no full scan).
   */
  findOutOfStock(): Promise<ProductEntity[]>;

  createVariant(variant: any, currentUser: TokenPayload | null): Promise<ProductVariantEntity>;
  getProductVariants(productId: string): Promise<ProductVariantEntity[]>;
  /** Looks up a single variant by its own id (not the parent productId). */
  findVariantById(id: string): Promise<ProductVariantEntity | null>;
  updateVariant(id: string, variantData: Partial<any>, currentUser: TokenPayload | null): Promise<ProductVariantEntity>;
  deleteVariant(id: string, currentUser: TokenPayload | null): Promise<void>;
}
