import crypto from 'crypto';
import { BusinessLogicError } from '../errors/DomainError';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title?: string;
  comment?: string;
  /** @deprecated Use status instead. Retained for backward compat during rolling deploy. */
  isApproved: boolean;
  isVerified: boolean;
  helpfulCount: number;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class ProductReviewEntity implements ProductReview {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly userId: string,
    public readonly rating: number,
    public readonly isApproved: boolean,
    public readonly isVerified: boolean,
    public readonly helpfulCount: number,
    public readonly status: ReviewStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly title?: string,
    public readonly comment?: string,
  ) {}

  static create(data: {
    productId: string;
    userId: string;
    rating: number;
    title?: string;
    comment?: string;
  }): ProductReviewEntity {
    const now = new Date();
    return new ProductReviewEntity(
      crypto.randomUUID(),
      data.productId,
      data.userId,
      data.rating,
      false,
      false,
      0,
      'pending',
      now,
      now,
      data.title,
      data.comment,
    );
  }

  /**
   * Returns a new instance with status=approved and isApproved=true (keeps deprecated field in sync).
   * Throws BusinessLogicError if the review is already rejected.
   */
  approve(): ProductReviewEntity {
    if (this.status === 'rejected') {
      throw new BusinessLogicError(
        `Cannot approve a review that is already rejected (id: ${this.id})`,
      );
    }
    if (this.status === 'approved') {
      throw new BusinessLogicError(
        `Review is already approved (id: ${this.id})`,
      );
    }
    return new ProductReviewEntity(
      this.id,
      this.productId,
      this.userId,
      this.rating,
      true,
      this.isVerified,
      this.helpfulCount,
      'approved',
      this.createdAt,
      new Date(),
      this.title,
      this.comment,
    );
  }

  /**
   * Returns a new instance with status=rejected and isApproved=false.
   * Throws BusinessLogicError if the review is already approved.
   */
  reject(): ProductReviewEntity {
    if (this.status === 'approved') {
      throw new BusinessLogicError(
        `Cannot reject a review that is already approved (id: ${this.id})`,
      );
    }
    if (this.status === 'rejected') {
      throw new BusinessLogicError(
        `Review is already rejected (id: ${this.id})`,
      );
    }
    return new ProductReviewEntity(
      this.id,
      this.productId,
      this.userId,
      this.rating,
      false,
      this.isVerified,
      this.helpfulCount,
      'rejected',
      this.createdAt,
      new Date(),
      this.title,
      this.comment,
    );
  }

  updateContent(data: { rating?: number; title?: string; comment?: string }): ProductReviewEntity {
    return new ProductReviewEntity(
      this.id,
      this.productId,
      this.userId,
      data.rating ?? this.rating,
      this.isApproved,
      this.isVerified,
      this.helpfulCount,
      this.status,
      this.createdAt,
      new Date(),
      data.title ?? this.title,
      data.comment ?? this.comment,
    );
  }
}
