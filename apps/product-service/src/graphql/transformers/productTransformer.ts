import { ProductEntity, ProductVariant, ProductVariantEntity, TaxAffectation } from '../../domain/entities/Product';

function buildImageUrl(imagePath: string): string {
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  const base = (process.env.STORAGE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
  const clean = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  return `${base}/${clean}`;
}

export function transformProduct(product: ProductEntity) {
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    price: product.price,
    salePrice: product.salePrice,
    sku: product.sku,
    images: product.images.map(buildImageUrl),
    attributes: product.attributes,
    isActive: product.isActive,
    stockQuantity: product.stockQuantity,
    tags: product.tags || [],
    rating: product.rating,
    reviewCount: product.reviewCount,
    taxAffectation: product.taxAffectation,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    currentPrice: product.getCurrentPrice(),
    hasDiscount: product.hasDiscount(),
    discountPercentage: product.getDiscountPercentage(),
    totalStock: product.getTotalStock(),
    isInStock: product.isInStock(),
    // Pass product's taxAffectation so each variant can resolve inheritance when its own is null.
    variants: product.variants?.map((v) => transformVariant(v, product.taxAffectation)) || [],
  };
}

/**
 * Transforms a ProductVariant (or ProductVariantEntity) to its GraphQL DTO shape.
 *
 * @param variant - The variant entity or interface to transform.
 * @param parentTaxAffectation - Optional taxAffectation of the parent Product.
 *   When provided, resolves the inheritance rule:
 *   effective = variant.taxAffectation ?? parentTaxAffectation.
 *   When absent (standalone query, no product context), the raw nullable value is returned —
 *   callers that need the effective value must resolve it themselves.
 *
 * NOTE: Do NOT pass this function directly as an Array.map() callback when the second
 * argument is optional — the callback index (number) would be passed as parentTaxAffectation.
 * Use an explicit lambda instead: variants.map((v) => transformVariant(v)).
 */
export function transformVariant(
  variant: ProductVariant | ProductVariantEntity,
  parentTaxAffectation?: TaxAffectation,
) {
  return {
    id: variant.id,
    productId: variant.productId,
    name: variant.name,
    sku: variant.sku,
    price: variant.price,
    stockQuantity: variant.stockQuantity,
    attributes: variant.attributes,
    isActive: variant.isActive,
    // Effective affectation: variant-level overrides parent; null means "inherit from parent".
    taxAffectation: variant.taxAffectation ?? parentTaxAffectation ?? null,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
    // Use method if available (ProductVariantEntity); fall back to property check (ProductVariant interface).
    isInStock: typeof (variant as ProductVariantEntity).isInStock === 'function'
      ? (variant as ProductVariantEntity).isInStock()
      : variant.stockQuantity > 0,
  };
}
