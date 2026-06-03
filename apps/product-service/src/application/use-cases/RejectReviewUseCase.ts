import type { TokenPayload } from '@hbs/auth';
import { hasPermission } from '@hbs/authz';
import { LoggerFactory } from '@hbs/logging';
import { ValidationError, ForbiddenError } from '../../domain/errors/DomainError';
import { IProductReviewRepository } from '../../domain/repositories/IProductReviewRepository';
import { ProductReviewEntity } from '../../domain/entities/ProductReview';

export class RejectReviewUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger('RejectReviewUseCase');

  constructor(private readonly reviewRepository: IProductReviewRepository) {}

  async execute(id: string, currentUser: TokenPayload): Promise<ProductReviewEntity> {
    if (!id) throw new ValidationError("Field 'id' is required");

    // Non-throwing check — ForbiddenError is a DomainError, not GraphQLError.
    // The resolver maps DomainError → GraphQL extension codes, keeping the
    // application layer free of any HTTP/GraphQL knowledge.
    if (!hasPermission(currentUser, 'reviews:moderate')) {
      throw new ForbiddenError('Permission denied: reviews:moderate required');
    }

    const rejected = await this.reviewRepository.reject(id);

    this.logger.info('review rejected', {
      reviewId: id,
      moderatorId: currentUser.userId,
      productId: rejected.productId,
    });

    return rejected;
  }
}
