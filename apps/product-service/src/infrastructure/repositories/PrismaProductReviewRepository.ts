import { PrismaClient, Prisma } from '../../prisma';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '../../domain/errors/DomainError';
import { IProductReviewRepository } from '../../domain/repositories/IProductReviewRepository';
import { ProductReviewEntity, ReviewStatus } from '../../domain/entities/ProductReview';

/**
 * Maps a P2025 (record not found during update/delete) to NotFoundError so that a
 * concurrent delete between findUnique and update does not surface as an opaque 500.
 * Re-throws all other errors unchanged.
 */
function mapP2025(error: unknown, label: string, id: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throw new NotFoundError(label, id);
  }
  throw error;
}

export class PrismaProductReviewRepository implements IProductReviewRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger(
      'PrismaProductReviewRepository',
    );
  }

  async create(review: ProductReviewEntity): Promise<ProductReviewEntity> {
    try {
      const created = await this.prisma.productReview.create({
        data: {
          id: review.id,
          productId: review.productId,
          userId: review.userId,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          isApproved: review.isApproved,
          isVerified: review.isVerified,
          helpfulCount: review.helpfulCount,
          status: review.status,
        },
      });
      return this.mapToEntity(created);
    } catch (error) {
      this.logger.error(
        'Failed to create product review',
        error instanceof Error ? error : new Error(String(error)),
        { productId: review.productId, userId: review.userId },
      );
      throw error;
    }
  }

  async findById(id: string): Promise<ProductReviewEntity | null> {
    try {
      const row = await this.prisma.productReview.findUnique({ where: { id } });
      return row ? this.mapToEntity(row) : null;
    } catch (error) {
      this.logger.error(
        'Failed to find product review by id',
        error instanceof Error ? error : new Error(String(error)),
        { reviewId: id },
      );
      throw error;
    }
  }

  async findByProduct(
    productId: string,
    options: { status?: ReviewStatus; limit: number; offset: number },
  ): Promise<{ reviews: ProductReviewEntity[]; total: number }> {
    const where: any = { productId };
    if (options.status) where.status = options.status;

    const [rows, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit,
        skip: options.offset,
      }),
      this.prisma.productReview.count({ where }),
    ]);

    return { reviews: rows.map((r) => this.mapToEntity(r)), total };
  }

  async findByUser(userId: string): Promise<ProductReviewEntity[]> {
    const rows = await this.prisma.productReview.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapToEntity(r));
  }

  async update(
    id: string,
    data: Partial<Pick<ProductReviewEntity, 'rating' | 'title' | 'comment'>>,
  ): Promise<ProductReviewEntity> {
    const updateData: any = {};
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.comment !== undefined) updateData.comment = data.comment;

    try {
      const updated = await this.prisma.productReview.update({
        where: { id },
        data: updateData,
      });
      return this.mapToEntity(updated);
    } catch (error) {
      this.logger.error(
        'Failed to update product review',
        error instanceof Error ? error : new Error(String(error)),
        { reviewId: id },
      );
      mapP2025(error, 'ProductReview', id);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.productReview.delete({ where: { id } });
    } catch (error) {
      this.logger.error(
        'Failed to delete product review',
        error instanceof Error ? error : new Error(String(error)),
        { reviewId: id },
      );
      mapP2025(error, 'ProductReview', id);
    }
  }

  async approve(id: string): Promise<ProductReviewEntity> {
    const existing = await this.prisma.productReview.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('ProductReview', id);

    // Enforce state machine via entity — throws BusinessLogicError on illegal transition
    const entity = this.mapToEntity(existing);
    const approved = entity.approve();

    try {
      const updated = await this.prisma.productReview.update({
        where: { id },
        data: {
          status: approved.status,
          isApproved: approved.isApproved,
        },
      });
      this.logger.info('Review approved', { reviewId: id });
      return this.mapToEntity(updated);
    } catch (error) {
      this.logger.error(
        'Failed to approve product review',
        error instanceof Error ? error : new Error(String(error)),
        { reviewId: id },
      );
      // Concurrent delete between findUnique and update → surface as NotFoundError
      mapP2025(error, 'ProductReview', id);
    }
  }

  async reject(id: string): Promise<ProductReviewEntity> {
    const existing = await this.prisma.productReview.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('ProductReview', id);

    const entity = this.mapToEntity(existing);
    const rejected = entity.reject();

    try {
      const updated = await this.prisma.productReview.update({
        where: { id },
        data: {
          status: rejected.status,
          isApproved: rejected.isApproved,
        },
      });
      this.logger.info('Review rejected', { reviewId: id });
      return this.mapToEntity(updated);
    } catch (error) {
      this.logger.error(
        'Failed to reject product review',
        error instanceof Error ? error : new Error(String(error)),
        { reviewId: id },
      );
      // Concurrent delete between findUnique and update → surface as NotFoundError
      mapP2025(error, 'ProductReview', id);
    }
  }

  private mapToEntity(row: any): ProductReviewEntity {
    return new ProductReviewEntity(
      row.id,
      row.productId,
      row.userId,
      row.rating,
      row.isApproved,
      row.isVerified,
      row.helpfulCount,
      (row.status ?? 'pending') as ReviewStatus,
      row.createdAt,
      row.updatedAt,
      row.title ?? undefined,
      row.comment ?? undefined,
    );
  }
}
