import { ProductEntity, ProductVariantEntity } from '../../domain/entities/Product';

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
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    currentPrice: product.getCurrentPrice(),
    hasDiscount: product.hasDiscount(),
    discountPercentage: product.getDiscountPercentage(),
    totalStock: product.getTotalStock(),
    isInStock: product.isInStock(),
    variants: product.variants?.map(transformVariant) || [],
  };
}

export function transformVariant(variant: ProductVariantEntity) {
  return {
    id: variant.id,
    productId: variant.productId,
    name: variant.name,
    sku: variant.sku,
    price: variant.price,
    stockQuantity: variant.stockQuantity,
    attributes: variant.attributes,
    isActive: variant.isActive,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
    isInStock: variant.isInStock(),
  };
}
