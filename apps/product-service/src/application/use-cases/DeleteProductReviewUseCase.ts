import type { TokenPayload } from '@hbs/auth';
import { isAdmin } from '@hbs/authz';
import { LoggerFactory } from '@hbs/logging';
import { NotFoundError, ValidationError } from '../../domain/errors/DomainError';
import { IProductReviewRepository } from '../../domain/repositories/IProductReviewRepository';

export class DeleteProductReviewUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'DeleteProductReviewUseCase',
  );

  constructor(private readonly reviewRepository: IProductReviewRepository) {}

  async execute(id: string, currentUser: TokenPayload): Promise<void> {
    if (!id) throw new ValidationError("Field 'id' is required");

    const existing = await this.reviewRepository.findById(id);

    const callerId = currentUser.userId;
    const callerIsAdmin = isAdmin(currentUser);

    // Anti-enumeration: same NOT_FOUND whether it doesn't exist or caller doesn't own it.
    if (!existing || (!callerIsAdmin && existing.userId !== callerId)) {
      this.logger.info('deleteProductReview: denied (BOLA guard)', {
        reviewId: id,
        callerId,
        callerIsAdmin,
        reviewExists: !!existing,
      });
      throw new NotFoundError('ProductReview', id);
    }

    await this.reviewRepository.delete(id);

    this.logger.info('review deleted', {
      reviewId: id,
      callerId,
      callerIsAdmin,
    });
  }
}
