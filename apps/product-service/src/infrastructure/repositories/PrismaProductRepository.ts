import { PrismaClient } from '../../prisma';
import type { TokenPayload } from '@hbs/auth';
import type { RecordRuleResolver } from '@hbs/authz';
import { assertWriteAccess } from '@hbs/authz';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '../../domain/errors/DomainError';
import { IProductRepository, ProductFilters } from '../../domain/repositories/IProductRepository';
import { ProductEntity, ProductVariantEntity } from '../../domain/entities/Product';

export class PrismaProductRepository implements IProductRepository {
  private readonly logger: ILogger;

  /**
   * @param prisma - Singleton PrismaClient from @hbs/prisma.
   * @param recordRuleResolver - Optional RecordRuleResolver for applying record-level
   *   access rules on write operations. When absent (e.g. in tests without RBAC),
   *   writes are unrestricted. When present, update/delete enforce write/unlink mode
   *   record rules before mutating. Read paths (findById/findAll) remain unrestricted
   *   because product listing is a public catalog operation; enforcement is applied
   *   at the resolver level via requireProductManagementAccess for admin queries.
   */
  constructor(
    private readonly prisma: PrismaClient,
    private readonly recordRuleResolver?: RecordRuleResolver,
  ) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaProductRepository');
  }

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
        tags: product.tags,
      },
      include: { variants: true },
    });
    return this.mapToEntity(created);
  }

  async findById(id: string): Promise<ProductEntity | null> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });
    return product ? this.mapToEntity(product) : null;
  }

  /**
   * Bypasses all record-level access rules.
   *
   * Use ONLY for callers without a user context (event consumers, internal background
   * jobs, stock updates from Redis stream events). NEVER call this from a resolver
   * mutation — use update/delete which enforce write-mode record rules.
   */
  async findByIdUnrestricted(id: string): Promise<ProductEntity | null> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: { variants: true },
      });
      return product ? this.mapToEntity(product) : null;
    } catch (error) {
      this.logger.error(
        'Error finding product (unrestricted)',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
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
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.sku) where.sku = { contains: filters.sku, mode: 'insensitive' };

    const products = await this.prisma.product.findMany({
      where,
      take: filters?.limit,
      skip: filters?.offset,
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });

    return products.map((p) => this.mapToEntity(p));
  }

  async update(
    id: string,
    product: Partial<ProductEntity>,
    currentUser: TokenPayload | null,
  ): Promise<ProductEntity> {
    // Enforce write-mode record rules before mutating.
    // assertWriteAccess throws NotFoundError (ambiguous 404) when the record does
    // not exist OR when the rule denies access — prevents enumeration oracle.
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Product',
      mode: 'write',
      id,
      currentUser,
      exists: (where) =>
        this.prisma.product
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });

    // assertWriteAccess already confirmed existence (or throws NotFoundError).
    // No additional findUnique needed — go directly to building the update payload.
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
      include: { variants: true },
    });
    return this.mapToEntity(updated);
  }

  /**
   * Verify write/unlink access on a product BEFORE any prefetch or business logic.
   *
   * Throws NotFoundError (ambiguous 404) when the product does not exist OR when
   * a record rule denies access — same semantics as assertWriteAccess inside
   * update/delete. Defence-in-depth: repo.update/delete still run their own
   * assertWriteAccess internally, preventing bypasses by callers that skip ensureWritable.
   */
  async ensureWritable(
    id: string,
    mode: 'write' | 'unlink',
    currentUser: TokenPayload | null,
  ): Promise<void> {
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Product',
      mode,
      id,
      currentUser,
      exists: (where) =>
        this.prisma.product
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });
  }

  async delete(id: string, currentUser: TokenPayload | null): Promise<void> {
    // Enforce unlink-mode record rules before deleting.
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Product',
      mode: 'unlink',
      id,
      currentUser,
      exists: (where) =>
        this.prisma.product
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });

    await this.prisma.product.delete({ where: { id } });
  }

  async findByCategory(categoryId: string): Promise<ProductEntity[]> {
    const products = await this.prisma.product.findMany({
      where: { categoryId },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
    return products.map((p) => this.mapToEntity(p));
  }

  async findBySku(sku: string): Promise<ProductEntity | null> {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: { variants: true },
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
          { tags: { hasSome: [query] } },
        ],
        isActive: true,
      },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
    return products.map((p) => this.mapToEntity(p));
  }

  async createVariant(variantData: any, currentUser: TokenPayload | null): Promise<ProductVariantEntity> {
    // Enforce create-access on the parent Product before adding a variant.
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Product',
      mode: 'write',
      id: variantData.productId,
      currentUser,
      exists: (where) =>
        this.prisma.product
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });

    const created = await this.prisma.productVariant.create({
      data: {
        name: variantData.name,
        sku: variantData.sku,
        price: variantData.price || 0,
        stockQuantity: variantData.stockQuantity,
        productId: variantData.productId,
        attributes: variantData.attributes || {},
        isActive: variantData.isActive ?? true,
      },
    });
    return this.mapToVariantEntity(created);
  }

  async getProductVariants(productId: string): Promise<ProductVariantEntity[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });
    return variants.map((v) => this.mapToVariantEntity(v));
  }

  async updateVariant(
    id: string,
    variantData: Partial<any>,
    currentUser: TokenPayload | null,
  ): Promise<ProductVariantEntity> {
    // Look up the variant's parent product to enforce write access on the Product model.
    const existingVariant = await this.prisma.productVariant.findUnique({ where: { id } });
    if (!existingVariant) throw new NotFoundError('ProductVariant', id);

    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Product',
      mode: 'write',
      id: existingVariant.productId,
      currentUser,
      exists: (where) =>
        this.prisma.product
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });

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

  async deleteVariant(id: string, currentUser: TokenPayload | null): Promise<void> {
    // Look up the variant's parent product to enforce unlink access on the Product model.
    const existingVariant = await this.prisma.productVariant.findUnique({ where: { id } });
    if (!existingVariant) throw new NotFoundError('ProductVariant', id);

    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Product',
      mode: 'unlink',
      id: existingVariant.productId,
      currentUser,
      exists: (where) =>
        this.prisma.product
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });

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
      product.variants ? product.variants.map((v: any) => this.mapToVariantEntity(v)) : [],
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
      variant.updatedAt,
    );
  }
}
