import { PrismaClient, Prisma } from '@prisma/client';
import { IProductRepository, ProductFilters } from '../../domain/repositories/IProductRepository';
import { ProductEntity, ProductVariantEntity } from '../../domain/entities/Product';

export class PrismaProductRepository implements IProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(product: ProductEntity): Promise<ProductEntity> {
    const created = await this.prisma.product.create({
      data: {
        name: product.name,
        description: product.description,
        price: product.price,
        salePrice: product.salePrice,
        sku: product.sku,
        categoryId: product.categoryId,
        isActive: product.isActive,
        stockQuantity: product.stockQuantity,
        images: product.images,
        attributes: product.attributes,
        tags: product.tags
      },
      include: { variants: true }
    });
    return this.mapToEntity(created);
  }

  async findById(id: string): Promise<ProductEntity | null> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: true }
    });
    return product ? this.mapToEntity(product) : null;
  }

  async findAll(filters?: ProductFilters): Promise<ProductEntity[]> {
    const where: any = {};

    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.minPrice || filters?.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }
    if (filters?.inStock) where.stockQuantity = { gt: 0 };
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }
    if (filters?.sku) where.sku = { contains: filters.sku, mode: 'insensitive' };

    const products = await this.prisma.product.findMany({
      where,
      take: filters?.limit,
      skip: filters?.offset,
      include: { variants: true },
      orderBy: { createdAt: 'desc' }
    });

    return products.map(p => this.mapToEntity(p));
  }

  async update(id: string, product: Partial<ProductEntity>): Promise<ProductEntity> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new Error('Product not found');

    const data: any = {};
    if (product.categoryId) data.categoryId = product.categoryId;
    if (product.name) data.name = product.name;
    if (product.description !== undefined) data.description = product.description;
    if (product.price) data.price = product.price;
    if (product.salePrice !== undefined) data.salePrice = product.salePrice;
    if (product.sku) data.sku = product.sku;
    if (product.images) data.images = product.images;
    if (product.attributes) data.attributes = product.attributes;
    if (product.isActive !== undefined) data.isActive = product.isActive;
    if (product.stockQuantity !== undefined) data.stockQuantity = product.stockQuantity;
    if (product.tags) data.tags = product.tags;
    if (product.rating !== undefined) data.rating = product.rating;
    if (product.reviewCount !== undefined) data.reviewCount = product.reviewCount;

    const updated = await this.prisma.product.update({
      where: { id },
      data,
      include: { variants: true }
    });
    return this.mapToEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });
  }

  async findByCategory(categoryId: string): Promise<ProductEntity[]> {
    const products = await this.prisma.product.findMany({
      where: { categoryId },
      include: { variants: true },
      orderBy: { createdAt: 'desc' }
    });
    return products.map(p => this.mapToEntity(p));
  }

  async findBySku(sku: string): Promise<ProductEntity | null> {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: { variants: true }
    });
    return product ? this.mapToEntity(product) : null;
  }

  async updateStock(id: string, stockQuantity: number): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new Error('Product not found');
    await this.prisma.product.update({ where: { id }, data: { stockQuantity } });
  }

  async search(query: string): Promise<ProductEntity[]> {
    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { tags: { hasSome: [query] } }
        ],
        isActive: true
      },
      include: { variants: true },
      orderBy: { createdAt: 'desc' }
    });
    return products.map(p => this.mapToEntity(p));
  }

  async createVariant(variantData: any): Promise<ProductVariantEntity> {
    const existing = await this.prisma.product.findUnique({ where: { id: variantData.productId } });
    if (!existing) throw new Error('Product not found');

    const created = await this.prisma.productVariant.create({
      data: {
        name: variantData.name,
        sku: variantData.sku,
        price: variantData.price || 0,
        stockQuantity: variantData.stockQuantity,
        productId: variantData.productId,
        attributes: variantData.attributes || {},
        isActive: variantData.isActive ?? true
      }
    });
    return this.mapToVariantEntity(created);
  }

  async getProductVariants(productId: string): Promise<ProductVariantEntity[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' }
    });
    return variants.map(v => this.mapToVariantEntity(v));
  }

  async updateVariant(id: string, variantData: Partial<any>): Promise<ProductVariantEntity> {
    const existing = await this.prisma.productVariant.findUnique({ where: { id } });
    if (!existing) throw new Error('Variant not found');

    const data: any = {};
    if (variantData.name) data.name = variantData.name;
    if (variantData.sku) data.sku = variantData.sku;
    if (variantData.price !== undefined) data.price = variantData.price;
    if (variantData.stockQuantity !== undefined) data.stockQuantity = variantData.stockQuantity;
    if (variantData.attributes) data.attributes = variantData.attributes;
    if (variantData.isActive !== undefined) data.isActive = variantData.isActive;

    const updated = await this.prisma.productVariant.update({ where: { id }, data });
    return this.mapToVariantEntity(updated);
  }

  async deleteVariant(id: string): Promise<void> {
    const existing = await this.prisma.productVariant.findUnique({ where: { id } });
    if (!existing) throw new Error('Variant not found');
    await this.prisma.productVariant.delete({ where: { id } });
  }

  private mapToEntity(product: any): ProductEntity {
    return new ProductEntity(
      product.id,
      product.categoryId,
      product.name,
      product.description || '',
      Number(product.price),
      product.salePrice ? Number(product.salePrice) : undefined,
      product.sku,
      product.images || [],
      (product.attributes as Record<string, any>) || {},
      product.isActive,
      product.stockQuantity,
      product.tags || [],
      product.rating ? Number(product.rating) : 0,
      product.reviewCount || 0,
      product.createdAt,
      product.updatedAt,
      product.variants ? product.variants.map((v: any) => this.mapToVariantEntity(v)) : []
    );
  }

  private mapToVariantEntity(variant: any): ProductVariantEntity {
    return new ProductVariantEntity(
      variant.id,
      variant.productId,
      variant.name || '',
      variant.sku,
      variant.price ? Number(variant.price) : 0,
      variant.stockQuantity,
      (variant.attributes as Record<string, any>) || {},
      variant.isActive,
      variant.createdAt,
      variant.updatedAt
    );
  }
}
