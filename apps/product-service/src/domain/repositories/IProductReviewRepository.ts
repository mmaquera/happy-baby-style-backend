import { ProductReviewEntity, ReviewStatus } from '../entities/ProductReview';

export interface ReviewFilters {
  productId?: string;
  userId?: string;
  status?: ReviewStatus;
  limit?: number;
  offset?: number;
}

export interface IProductReviewRepository {
  create(review: ProductReviewEntity): Promise<ProductReviewEntity>;
  findById(id: string): Promise<ProductReviewEntity | null>;

  /**
   * Paginated list of reviews for a product, optionally filtered by status.
   * Public endpoint uses status='approved'. Staff queries can pass status='pending'.
   */
  findByProduct(
    productId: string,
    options: { status?: ReviewStatus; limit: number; offset: number },
  ): Promise<{ reviews: ProductReviewEntity[]; total: number }>;

  findByUser(userId: string): Promise<ProductReviewEntity[]>;

  update(id: string, data: Partial<Pick<ProductReviewEntity, 'rating' | 'title' | 'comment'>>): Promise<ProductReviewEntity>;

  delete(id: string): Promise<void>;

  /**
   * Centralized status transition — approve. Throws BusinessLogicError via entity if
   * the current state makes the transition illegal.
   */
  approve(id: string): Promise<ProductReviewEntity>;

  /**
   * Centralized status transition — reject.
   */
  reject(id: string): Promise<ProductReviewEntity>;
}
