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
  
  // Relaciones
  category?: Category;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  productId: string;
  size?: string;
  color?: string;
  sku: string;
  price?: number;
  stockQuantity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  slug: string;
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
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
    public readonly category?: Category,
    public readonly variants?: ProductVariant[]
  ) {}

  static create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'rating' | 'reviewCount'>): ProductEntity {
    const now = new Date();
    return new ProductEntity(
      globalThis.crypto.randomUUID(),
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
      0, // rating inicial
      0, // reviewCount inicial
      now,
      now
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
      data.category ?? this.category,
      data.variants ?? this.variants
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
    const variantsStock = this.variants?.reduce((sum, variant) => sum + variant.stockQuantity, 0) || 0;
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
    public readonly size: string | undefined,
    public readonly color: string | undefined,
    public readonly sku: string,
    public readonly price: number | undefined,
    public readonly stockQuantity: number,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(data: Omit<ProductVariant, 'id' | 'createdAt' | 'updatedAt'>): ProductVariantEntity {
    const now = new Date();
    return new ProductVariantEntity(
      globalThis.crypto.randomUUID(),
      data.productId,
      data.size,
      data.color,
      data.sku,
      data.price,
      data.stockQuantity,
      data.isActive,
      now,
      now
    );
  }

  update(data: Partial<Omit<ProductVariant, 'id' | 'createdAt' | 'updatedAt'>>): ProductVariantEntity {
    return new ProductVariantEntity(
      this.id,
      data.productId ?? this.productId,
      data.size ?? this.size,
      data.color ?? this.color,
      data.sku ?? this.sku,
      data.price ?? this.price,
      data.stockQuantity ?? this.stockQuantity,
      data.isActive ?? this.isActive,
      this.createdAt,
      new Date()
    );
  }

  isInStock(): boolean {
    return this.stockQuantity > 0;
  }
}

export class CategoryEntity implements Category {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string | undefined,
    public readonly slug: string,
    public readonly imageUrl: string | undefined,
    public readonly isActive: boolean,
    public readonly sortOrder: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): CategoryEntity {
    const now = new Date();
    return new CategoryEntity(
      globalThis.crypto.randomUUID(),
      data.name,
      data.description,
      data.slug,
      data.imageUrl,
      data.isActive,
      data.sortOrder,
      now,
      now
    );
  }

  update(data: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>): CategoryEntity {
    return new CategoryEntity(
      this.id,
      data.name ?? this.name,
      data.description ?? this.description,
      data.slug ?? this.slug,
      data.imageUrl ?? this.imageUrl,
      data.isActive ?? this.isActive,
      data.sortOrder ?? this.sortOrder,
      this.createdAt,
      new Date()
    );
  }
}