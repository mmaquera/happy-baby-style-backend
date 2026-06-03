import type { TokenPayload } from '@hbs/auth';
import { hasPermission } from '@hbs/authz';
import { LoggerFactory } from '@hbs/logging';
import { ValidationError, ForbiddenError } from '../../domain/errors/DomainError';
import { IProductReviewRepository } from '../../domain/repositories/IProductReviewRepository';
import { ProductReviewEntity } from '../../domain/entities/ProductReview';

export class ApproveReviewUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger('ApproveReviewUseCase');

  constructor(private readonly reviewRepository: IProductReviewRepository) {}

  async execute(id: string, currentUser: TokenPayload): Promise<ProductReviewEntity> {
    if (!id) throw new ValidationError("Field 'id' is required");

    // Non-throwing check — ForbiddenError is a DomainError, not GraphQLError.
    // The resolver maps DomainError → GraphQL extension codes, keeping the
    // application layer free of any HTTP/GraphQL knowledge.
    if (!hasPermission(currentUser, 'reviews:moderate')) {
      throw new ForbiddenError('Permission denied: reviews:moderate required');
    }

    const approved = await this.reviewRepository.approve(id);

    this.logger.info('review approved', {
      reviewId: id,
      moderatorId: currentUser.userId,
      productId: approved.productId,
    });

    return approved;
  }
}
