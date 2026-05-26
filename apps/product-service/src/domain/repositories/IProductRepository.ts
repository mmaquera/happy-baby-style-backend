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
  findById(id: string): Promise<ProductEntity | null>;
  findAll(filters?: ProductFilters): Promise<ProductEntity[]>;
  update(id: string, product: Partial<ProductEntity>): Promise<ProductEntity>;
  delete(id: string): Promise<void>;
  findByCategory(categoryId: string): Promise<ProductEntity[]>;
  findBySku(sku: string): Promise<ProductEntity | null>;
  updateStock(id: string, stockQuantity: number): Promise<void>;
  search(query: string): Promise<ProductEntity[]>;

  createVariant(variant: any): Promise<ProductVariantEntity>;
  getProductVariants(productId: string): Promise<ProductVariantEntity[]>;
  updateVariant(id: string, variantData: Partial<any>): Promise<ProductVariantEntity>;
  deleteVariant(id: string): Promise<void>;
}
