import crypto from 'crypto';

export interface Product {
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
  createdAt: Date;
  updatedAt: Date;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  attributes: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ProductEntity implements Product {
  constructor(
    public readonly id: string,
    public readonly categoryId: string,
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
    public readonly salePrice: number | undefined,
    public readonly sku: string,
    public readonly images: string[],
    public readonly attributes: Record<string, any>,
    public readonly isActive: boolean,
    public readonly stockQuantity: number,
    public readonly tags: string[] | undefined,
    public readonly rating: number,
    public readonly reviewCount: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly variants?: ProductVariant[],
  ) {}

  static create(
    data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'rating' | 'reviewCount'>,
  ): ProductEntity {
    const now = new Date();
    return new ProductEntity(
      crypto.randomUUID(),
      data.categoryId,
      data.name,
      data.description,
      data.price,
      data.salePrice,
      data.sku,
      data.images || [],
      data.attributes || {},
      data.isActive,
      data.stockQuantity,
      data.tags,
      0,
      0,
      now,
      now,
    );
  }

  update(data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>): ProductEntity {
    return new ProductEntity(
      this.id,
      data.categoryId ?? this.categoryId,
      data.name ?? this.name,
      data.description ?? this.description,
      data.price ?? this.price,
      data.salePrice ?? this.salePrice,
      data.sku ?? this.sku,
      data.images ?? this.images,
      data.attributes ?? this.attributes,
      data.isActive ?? this.isActive,
      data.stockQuantity ?? this.stockQuantity,
      data.tags ?? this.tags,
      data.rating ?? this.rating,
      data.reviewCount ?? this.reviewCount,
      this.createdAt,
      new Date(),
      data.variants ?? this.variants,
    );
  }

  getCurrentPrice(): number {
    return this.salePrice || this.price;
  }

  hasDiscount(): boolean {
    return this.salePrice !== undefined && this.salePrice < this.price;
  }

  getDiscountPercentage(): number {
    if (!this.hasDiscount()) return 0;
    return Math.round(((this.price - this.salePrice!) / this.price) * 100);
  }

  getTotalStock(): number {
    const variantsStock = this.variants?.reduce((sum, v) => sum + v.stockQuantity, 0) || 0;
    return this.stockQuantity + variantsStock;
  }

  isInStock(): boolean {
    return this.getTotalStock() > 0;
  }
}

export class ProductVariantEntity implements ProductVariant {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly name: string,
    public readonly sku: string,
    public readonly price: number,
    public readonly stockQuantity: number,
    public readonly attributes: Record<string, any>,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(
    data: Omit<ProductVariant, 'id' | 'createdAt' | 'updatedAt'>,
  ): ProductVariantEntity {
    const now = new Date();
    return new ProductVariantEntity(
      crypto.randomUUID(),
      data.productId,
      data.name,
      data.sku,
      data.price,
      data.stockQuantity,
      data.attributes || {},
      data.isActive,
      now,
      now,
    );
  }

  isInStock(): boolean {
    return this.stockQuantity > 0;
  }
}
