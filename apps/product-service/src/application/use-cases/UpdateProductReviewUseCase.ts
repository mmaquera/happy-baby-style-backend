import type { TokenPayload } from '@hbs/auth';
import { isAdmin } from '@hbs/authz';
import { LoggerFactory } from '@hbs/logging';
import { NotFoundError, ValidationError } from '../../domain/errors/DomainError';
import { IProductReviewRepository } from '../../domain/repositories/IProductReviewRepository';
import { ProductReviewEntity } from '../../domain/entities/ProductReview';

export interface UpdateProductReviewRequest {
  id: string;
  rating?: number;
  title?: string;
  comment?: string;
  currentUser: TokenPayload;
}

export class UpdateProductReviewUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'UpdateProductReviewUseCase',
  );

  constructor(private readonly reviewRepository: IProductReviewRepository) {}

  async execute(request: UpdateProductReviewRequest): Promise<ProductReviewEntity> {
    const { id, rating, title, comment, currentUser } = request;

    if (!id) throw new ValidationError("Field 'id' is required");

    // Reject no-op updates — at least one field must be provided.
    if (rating === undefined && title === undefined && comment === undefined) {
      throw new ValidationError('At least one field (rating, title, comment) must be provided');
    }

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      throw new ValidationError("Field 'rating' must be between 1 and 5");
    }

    // Load review to enforce owner-or-admin check (BOLA fix).
    const existing = await this.reviewRepository.findById(id);

    const callerId = currentUser.userId;
    const callerIsAdmin = isAdmin(currentUser);

    // Anti-enumeration: return NOT_FOUND regardless of whether the review exists
    // or belongs to someone else — prevents ID probing by non-owners.
    if (!existing || (!callerIsAdmin && existing.userId !== callerId)) {
      this.logger.info('updateProductReview: denied (BOLA guard)', {
        reviewId: id,
        callerId,
        callerIsAdmin,
        reviewExists: !!existing,
      });
      throw new NotFoundError('ProductReview', id);
    }

    const updated = await this.reviewRepository.update(id, { rating, title, comment });

    this.logger.info('review updated', {
      reviewId: updated.id,
      callerId,
      callerIsAdmin,
    });

    return updated;
  }
}
