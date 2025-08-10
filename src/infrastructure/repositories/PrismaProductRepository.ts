import { IProductRepository, ProductFilters } from '@domain/repositories/IProductRepository';
import { ProductEntity, ProductVariantEntity } from '@domain/entities/Product';
import { PrismaClient } from '@prisma/client';

export class PrismaProductRepository implements IProductRepository {
  constructor(private prisma: PrismaClient) {}

  async create(product: ProductEntity): Promise<ProductEntity> {
    const created = await this.prisma.product.create({
      data: {
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        price: product.price,
        salePrice: product.salePrice,
        sku: product.sku,
        images: product.images || [],
        attributes: product.attributes || {},
        isActive: product.isActive ?? true,
        stockQuantity: product.stockQuantity || 0,
        tags: product.tags || [],
        rating: product.rating,
        reviewCount: product.reviewCount || 0,
      },
      include: {
        category: true,
        variants: true,
      }
    });

    return this.mapToProductEntity(created);
  }

  async findById(id: string): Promise<ProductEntity | null> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: true,
      }
    });

    return product ? this.mapToProductEntity(product) : null;
  }

  async findAll(filters?: ProductFilters): Promise<ProductEntity[]> {
    const where: any = {};

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.minPrice || filters?.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }

    if (filters?.inStock) {
      where.stockQuantity = { gt: 0 };
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        variants: true,
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit,
      skip: filters?.offset,
    });

    return products.map(product => this.mapToProductEntity(product));
  }

  async update(id: string, product: Partial<ProductEntity>): Promise<ProductEntity> {
    const updateData: any = {};

    if (product.categoryId) updateData.categoryId = product.categoryId;
    if (product.name) updateData.name = product.name;
    if (product.description !== undefined) updateData.description = product.description;
    if (product.price) updateData.price = product.price;
    if (product.salePrice !== undefined) updateData.salePrice = product.salePrice;
    if (product.sku) updateData.sku = product.sku;
    if (product.images) updateData.images = product.images;
    if (product.attributes) updateData.attributes = product.attributes;
    if (product.isActive !== undefined) updateData.isActive = product.isActive;
    if (product.stockQuantity !== undefined) updateData.stockQuantity = product.stockQuantity;
    if (product.tags) updateData.tags = product.tags;
    if (product.rating !== undefined) updateData.rating = product.rating;
    if (product.reviewCount !== undefined) updateData.reviewCount = product.reviewCount;

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        variants: true,
      }
    });

    return this.mapToProductEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.product.delete({
      where: { id }
    });
  }

  async count(filters?: ProductFilters): Promise<number> {
    const where: any = {};

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.minPrice || filters?.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }

    if (filters?.inStock) {
      where.stockQuantity = { gt: 0 };
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return await this.prisma.product.count({ where });
  }

  async findBySku(sku: string): Promise<ProductEntity | null> {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: {
        category: true,
        variants: true,
      }
    });

    return product ? this.mapToProductEntity(product) : null;
  }

  async findByCategory(categoryId: string): Promise<ProductEntity[]> {
    const products = await this.prisma.product.findMany({
      where: { categoryId },
      include: {
        category: true,
        variants: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return products.map(product => this.mapToProductEntity(product));
  }

  async updateStock(id: string, quantity: number): Promise<ProductEntity> {
    const updated = await this.prisma.product.update({
      where: { id },
      data: { stockQuantity: quantity },
      include: {
        category: true,
        variants: true,
      }
    });

    return this.mapToProductEntity(updated);
  }

  private mapToProductEntity(data: any): ProductEntity {
    return {
      id: data.id,
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      price: parseFloat(data.price.toString()),
      salePrice: data.salePrice ? parseFloat(data.salePrice.toString()) : undefined,
      sku: data.sku,
      images: data.images || [],
      attributes: data.attributes || {},
      isActive: data.isActive,
      stockQuantity: data.stockQuantity,
      tags: data.tags || [],
      rating: data.rating ? parseFloat(data.rating.toString()) : undefined,
      reviewCount: data.reviewCount,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      variants: data.variants?.map((variant: any) => this.mapToVariantEntity(variant)) || []
    };
  }

  private mapToVariantEntity(data: any): ProductVariantEntity {
    return {
      id: data.id,
      productId: data.productId,
      name: data.name,
      price: parseFloat(data.price.toString()),
      sku: data.sku,
      stockQuantity: data.stockQuantity,
      attributes: data.attributes || {},
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }
}