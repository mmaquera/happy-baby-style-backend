import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory } from '@hbs/logging';
import { NotFoundError, DuplicateError, ValidationError } from '../../domain/errors/DomainError';
import { IProductReviewRepository } from '../../domain/repositories/IProductReviewRepository';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { ProductReviewEntity } from '../../domain/entities/ProductReview';

export interface CreateProductReviewRequest {
  productId: string;
  rating: number;
  title?: string;
  comment?: string;
  /** Author is always taken from the JWT — never accepted from client input (BOLA prevention). */
  currentUser: TokenPayload;
}

export class CreateProductReviewUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'CreateProductReviewUseCase',
  );

  constructor(
    private readonly reviewRepository: IProductReviewRepository,
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(request: CreateProductReviewRequest): Promise<ProductReviewEntity> {
    const { productId, rating, title, comment, currentUser } = request;

    if (!productId) throw new ValidationError("Field 'productId' is required");
    if (!rating) throw new ValidationError("Field 'rating' is required");
    if (rating < 1 || rating > 5)
      throw new ValidationError("Field 'rating' must be between 1 and 5");

    // Verify the product exists (public catalog read — no record-rule enforcement needed).
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundError('Product', productId);

    // Author is ALWAYS from JWT — never from input (BOLA prevention).
    const authorId = currentUser.userId;

    const review = ProductReviewEntity.create({ productId, userId: authorId, rating, title, comment });

    try {
      const saved = await this.reviewRepository.create(review);
      this.logger.info('review created', {
        reviewId: saved.id,
        productId: saved.productId,
        authorId,
      });
      return saved;
    } catch (error: any) {
      // P2002 unique constraint — same user already reviewed this product.
      if (error?.code === 'P2002') {
        throw new DuplicateError('ProductReview', 'productId+userId', `${productId}:${authorId}`);
      }
      throw error;
    }
  }
}
