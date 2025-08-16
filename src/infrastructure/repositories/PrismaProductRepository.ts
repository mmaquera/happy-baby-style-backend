import { PrismaClient, Product, ProductVariant, Prisma } from '@prisma/client';
import { IProductRepository, ProductFilters } from '@domain/repositories/IProductRepository';
import { ProductEntity, ProductVariantEntity } from '@domain/entities/Product';
import { DomainError } from '../../domain/errors/DomainError';
import { ILogger } from '../../domain/interfaces/ILogger';
import { LoggerFactory } from '../../infrastructure/logging/LoggerFactory';

export class PrismaProductRepository implements IProductRepository {
  private readonly logger: ILogger;

  constructor(private prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaProductRepository');
  }

  async create(product: ProductEntity): Promise<ProductEntity> {
    const traceId = `create-product-${Date.now()}`;
    
    try {
      this.logger.debug('Creating new product', {
        name: product.name,
        categoryId: product.categoryId,
        traceId
      });

      const createdProduct = await this.prisma.product.create({
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
        include: {
          category: true,
          variants: true
        }
      });

      const productEntity = this.mapToProductEntity(createdProduct);
      
      this.logger.info('Product created successfully', {
        productId: productEntity.id,
        name: productEntity.name,
        traceId
      });

      return productEntity;
    } catch (error) {
      this.logger.error('Failed to create product', error instanceof Error ? error : new Error(String(error)), {
        name: product.name,
        categoryId: product.categoryId,
        traceId
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('Product with this SKU already exists');
        }
        if (error.code === 'P2003') {
          throw new Error('Category not found');
        }
      }

      throw error;
    }
  }

  async findById(id: string): Promise<ProductEntity | null> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          variants: true
        }
      });

      if (!product) {
        this.logger.debug('Product not found', {
          productId: id
        });
        return null;
      }

      const productEntity = this.mapToProductEntity(product);
      
      this.logger.debug('Product found successfully', {
        productId: id,
        name: productEntity.name
      });

      return productEntity;
    } catch (error) {
      this.logger.error('Failed to find product by ID', error instanceof Error ? error : new Error(String(error)), {
        productId: id
      });

      throw error;
    }
  }

  async findAll(filters?: ProductFilters): Promise<ProductEntity[]> {
    try {
      this.logger.debug('Finding all products', {
        filters
      });

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

      if (filters?.sku) {
        where.sku = { contains: filters.sku, mode: 'insensitive' };
      }

      const products = await this.prisma.product.findMany({
        where,
        take: filters?.limit,
        skip: filters?.offset,
        include: {
          category: true,
          variants: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const productEntities = products.map(product => this.mapToProductEntity(product));
      
      this.logger.debug('Products found successfully', {
        count: productEntities.length
      });

      return productEntities;
    } catch (error) {
      this.logger.error('Failed to find all products', error instanceof Error ? error : new Error(String(error)), {
        filters
      });

      throw error;
    }
  }

  async update(id: string, product: Partial<ProductEntity>): Promise<ProductEntity> {
    const traceId = `update-product-${Date.now()}`;
    
    try {
      this.logger.debug('Updating product', {
        productId: id,
        changes: Object.keys(product),
        traceId
      });

      // Validate if product exists
      const existingProduct = await this.prisma.product.findUnique({
        where: { id }
      });

      if (!existingProduct) {
        this.logger.warn('Product not found for update', {
          productId: id,
          traceId
        });
        throw new Error('Product not found');
      }

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

      const updatedProduct = await this.prisma.product.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          variants: true
        }
      });

      const productEntity = this.mapToProductEntity(updatedProduct);
      
      this.logger.info('Product updated successfully', {
        productId: id,
        name: productEntity.name,
        traceId
      });

      return productEntity;
    } catch (error) {
      this.logger.error('Failed to update product', error instanceof Error ? error : new Error(String(error)), {
        productId: id,
        traceId
      });

      if (error instanceof DomainError) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('Product with this SKU already exists');
        }
        if (error.code === 'P2003') {
          throw new Error('Category not found');
        }
      }

      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const traceId = `delete-product-${Date.now()}`;
    
    try {
      this.logger.debug('Deleting product', {
        productId: id,
        traceId
      });

      // Validate if product exists
      const existingProduct = await this.prisma.product.findUnique({
        where: { id }
      });

      if (!existingProduct) {
        this.logger.warn('Product not found for deletion', {
          productId: id,
          traceId
        });
        throw new Error('Product not found');
      }

      await this.prisma.product.delete({
        where: { id }
      });
      
      this.logger.info('Product deleted successfully', {
        productId: id,
        traceId
      });
    } catch (error) {
      this.logger.error('Failed to delete product', error instanceof Error ? error : new Error(String(error)), {
        productId: id,
        traceId
      });

      if (error instanceof DomainError) {
        throw error;
      }

      throw error;
    }
  }

  async findByCategory(categoryId: string): Promise<ProductEntity[]> {
    try {
      this.logger.debug('Finding products by category', {
        categoryId
      });

      const products = await this.prisma.product.findMany({
        where: { categoryId },
        include: {
          category: true,
          variants: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const productEntities = products.map(product => this.mapToProductEntity(product));
      
      this.logger.debug('Products found by category successfully', {
        categoryId,
        count: productEntities.length
      });

      return productEntities;
    } catch (error) {
      this.logger.error('Failed to find products by category', error instanceof Error ? error : new Error(String(error)), {
        categoryId
      });

      throw error;
    }
  }

  async findBySku(sku: string): Promise<ProductEntity | null> {
    try {
      this.logger.debug('Finding product by SKU', {
        sku
      });

      const product = await this.prisma.product.findUnique({
        where: { sku },
        include: {
          category: true,
          variants: true
        }
      });

      if (!product) {
        this.logger.debug('Product not found by SKU', {
          sku
        });
        return null;
      }

      const productEntity = this.mapToProductEntity(product);
      
      this.logger.debug('Product found by SKU successfully', {
        sku,
        productId: productEntity.id
      });

      return productEntity;
    } catch (error) {
      this.logger.error('Failed to find product by SKU', error instanceof Error ? error : new Error(String(error)), {
        sku
      });

      throw error;
    }
  }

  async updateStock(id: string, stockQuantity: number): Promise<void> {
    try {
      this.logger.debug('Updating product stock', {
        productId: id,
        stockQuantity
      });

      // Validate if product exists
      const existingProduct = await this.prisma.product.findUnique({
        where: { id }
      });

      if (!existingProduct) {
        this.logger.warn('Product not found for stock update', {
          productId: id
        });
        throw new Error('Product not found');
      }

      await this.prisma.product.update({
        where: { id },
        data: { stockQuantity }
      });
      
      this.logger.debug('Product stock updated successfully', {
        productId: id,
        stockQuantity
      });
    } catch (error) {
      this.logger.error('Failed to update product stock', error instanceof Error ? error : new Error(String(error)), {
        productId: id,
        stockQuantity
      });

      if (error instanceof DomainError) {
        throw error;
      }

      throw error;
    }
  }

  async search(query: string): Promise<ProductEntity[]> {
    try {
      this.logger.debug('Searching products', {
        query
      });

      const products = await this.prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { tags: { hasSome: [query] } }
          ],
          isActive: true
        },
        include: {
          category: true,
          variants: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const productEntities = products.map(product => this.mapToProductEntity(product));
      
      this.logger.debug('Product search completed', {
        query,
        resultsCount: productEntities.length
      });

      return productEntities;
    } catch (error) {
      this.logger.error('Failed to search products', error instanceof Error ? error : new Error(String(error)), {
        query
      });

      throw error;
    }
  }

  async createVariant(variant: any): Promise<any> {
    const traceId = `create-variant-${Date.now()}`;
    
    try {
      this.logger.debug('Creating product variant', {
        productId: variant.productId,
        variantName: variant.name,
        traceId
      });

      // Validate if product exists
      const existingProduct = await this.prisma.product.findUnique({
        where: { id: variant.productId }
      });

      if (!existingProduct) {
        this.logger.warn('Product not found for variant creation', {
          productId: variant.productId,
          traceId
        });
        throw new Error('Product not found');
      }

      const createdVariant = await this.prisma.productVariant.create({
        data: {
          name: variant.name,
          sku: variant.sku,
          price: variant.price || 0,
          stockQuantity: variant.stockQuantity,
          productId: variant.productId,
          attributes: variant.attributes,
          isActive: variant.isActive
        }
      });

      const variantEntity = this.mapToVariantEntity(createdVariant);
      
      this.logger.info('Product variant created successfully', {
        variantId: variantEntity.id,
        productId: variant.productId,
        traceId
      });

      return variantEntity;
    } catch (error) {
      this.logger.error('Failed to create product variant', error instanceof Error ? error : new Error(String(error)), {
        productId: variant.productId,
        traceId
      });

      if (error instanceof DomainError) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('Variant with this SKU already exists');
        }
      }

      throw error;
    }
  }

  async getProductVariants(productId: string): Promise<any[]> {
    try {
      this.logger.debug('Getting product variants', {
        productId
      });

      const variants = await this.prisma.productVariant.findMany({
        where: { productId },
        orderBy: { createdAt: 'asc' }
      });

      const variantEntities = variants.map(variant => this.mapToVariantEntity(variant));
      
      this.logger.debug('Product variants retrieved successfully', {
        productId,
        variantsCount: variantEntities.length
      });

      return variantEntities;
    } catch (error) {
      this.logger.error('Failed to get product variants', error instanceof Error ? error : new Error(String(error)), {
        productId
      });

      throw error;
    }
  }

  async updateVariant(id: string, variantData: Partial<any>): Promise<any> {
    const traceId = `update-variant-${Date.now()}`;
    
    try {
      this.logger.debug('Updating product variant', {
        variantId: id,
        changes: Object.keys(variantData),
        traceId
      });

      // Validate if variant exists
      const existingVariant = await this.prisma.productVariant.findUnique({
        where: { id }
      });

      if (!existingVariant) {
        this.logger.warn('Variant not found for update', {
          variantId: id,
          traceId
        });
        throw new Error('Variant not found');
      }

      const updateData: any = {};

      if (variantData.name) updateData.name = variantData.name;
      if (variantData.sku) updateData.sku = variantData.sku;
      if (variantData.price !== undefined) updateData.price = variantData.price;
      if (variantData.stockQuantity !== undefined) updateData.stockQuantity = variantData.stockQuantity;
      if (variantData.attributes) updateData.attributes = variantData.attributes;
      if (variantData.isActive !== undefined) updateData.isActive = variantData.isActive;

      const variant = await this.prisma.productVariant.update({
        where: { id },
        data: updateData
      });

      const variantEntity = this.mapToVariantEntity(variant);
      
      this.logger.info('Product variant updated successfully', {
        variantId: id,
        traceId
      });

      return variantEntity;
    } catch (error) {
      this.logger.error('Failed to update product variant', error instanceof Error ? error : new Error(String(error)), {
        variantId: id,
        traceId
      });

      if (error instanceof DomainError) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('Variant with this SKU already exists');
        }
      }

      throw error;
    }
  }

  async deleteVariant(id: string): Promise<void> {
    const traceId = `delete-variant-${Date.now()}`;
    
    try {
      this.logger.debug('Deleting product variant', {
        variantId: id,
        traceId
      });

      // Validate if variant exists
      const existingVariant = await this.prisma.productVariant.findUnique({
        where: { id }
      });

      if (!existingVariant) {
        this.logger.warn('Variant not found for deletion', {
          variantId: id,
          traceId
        });
        throw new Error('Variant not found');
      }

      await this.prisma.productVariant.delete({
        where: { id }
      });
      
      this.logger.info('Product variant deleted successfully', {
        variantId: id,
        traceId
      });
    } catch (error) {
      this.logger.error('Failed to delete product variant', error instanceof Error ? error : new Error(String(error)), {
        variantId: id,
        traceId
      });

      if (error instanceof DomainError) {
        throw error;
      }

      throw error;
    }
  }

  async getCategories(): Promise<any[]> {
    try {
      this.logger.debug('Getting all categories');

      const categories = await this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      });
      
      this.logger.debug('Categories retrieved successfully', {
        count: categories.length
      });

      return categories;
    } catch (error) {
      this.logger.error('Failed to get categories', error instanceof Error ? error : new Error(String(error)));

      throw error;
    }
  }

  private mapToProductEntity(product: Product & { category?: any; variants?: ProductVariant[] }): ProductEntity {
    return new ProductEntity(
      product.id,
      product.categoryId,
      product.name,
      product.description || '',
      Number(product.price),
      product.salePrice ? Number(product.salePrice) : undefined,
      product.sku,
      product.images,
      product.attributes as Record<string, any>,
      product.isActive,
      product.stockQuantity,
      product.tags,
      product.rating ? Number(product.rating) : 0,
      product.reviewCount,
      product.createdAt,
      product.updatedAt,
      product.category ? {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
        description: product.category.description,
        isActive: product.category.isActive,
        sortOrder: product.category.sortOrder,
        createdAt: product.category.createdAt,
        updatedAt: product.category.updatedAt
      } : undefined,
      product.variants ? product.variants.map(variant => this.mapToVariantEntity(variant)) : []
    );
  }

  private mapToVariantEntity(variant: ProductVariant): ProductVariantEntity {
    return new ProductVariantEntity(
      variant.id,
      variant.productId,
      undefined, // size no está en el schema
      undefined, // color no está en el schema
      variant.sku,
      variant.price ? Number(variant.price) : undefined,
      variant.stockQuantity,
      variant.isActive,
      variant.createdAt,
      variant.updatedAt
    );
  }
}