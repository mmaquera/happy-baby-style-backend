import { ProductEntity } from '@domain/entities/Product';
import { UrlBuilder } from '@shared/utils/UrlBuilder';

export interface GraphQLProduct {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  salePrice?: number;
  sku: string;
  images: string[];
  attributes: Record<string, any>;
  isActive: boolean;
  stockQuantity: number;
  tags?: string[];
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;

  // Computed fields
  currentPrice: number;
  hasDiscount: boolean;
  discountPercentage: number;
  totalStock: number;
  isInStock: boolean;

  // Relations
  category?: any;
  variants?: any[];
}

export function transformProduct(product: ProductEntity): GraphQLProduct {
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    price: product.price,
    salePrice: product.salePrice,
    sku: product.sku,
    images: product.images.map((imageUrl) => {
      // Si es una URL absoluta, devolverla tal como está
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
      }
      // Si es una ruta relativa, convertirla a URL completa
      return UrlBuilder.buildPublicUrl(imageUrl);
    }),
    attributes: product.attributes,
    isActive: product.isActive,
    stockQuantity: product.stockQuantity,
    tags: product.tags,
    rating: product.rating,
    reviewCount: product.reviewCount,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),

    // Computed fields
    currentPrice: product.getCurrentPrice(),
    hasDiscount: product.hasDiscount(),
    discountPercentage: product.getDiscountPercentage(),
    totalStock: product.getTotalStock(),
    isInStock: product.isInStock(),

    // Relations
    category: product.category,
    variants: product.variants || [],
  };
}

export function transformProducts(products: ProductEntity[]): GraphQLProduct[] {
  return products.map(transformProduct);
}
