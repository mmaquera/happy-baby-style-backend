import type { TokenPayload } from '@hbs/auth';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { NotFoundError, ValidationError } from '../../domain/errors/DomainError';
import { LoggerFactory } from '@hbs/logging';

export class DeleteProductUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteProductUseCase');

  constructor(private readonly productRepository: IProductRepository) {}

  async execute(id: string, currentUser: TokenPayload | null = null): Promise<void> {
    if (!id) throw new ValidationError('Product ID is required');

    // Existence check via unrestricted read — record-rule enforcement (unlink mode)
    // is applied inside repo.delete() via assertWriteAccess.
    const existing = await this.productRepository.findByIdUnrestricted(id);
    if (!existing) throw new NotFoundError('Product', id);

    this.logger.info('Deleting product', { productId: id });
    await this.productRepository.delete(id, currentUser);
  }
}
