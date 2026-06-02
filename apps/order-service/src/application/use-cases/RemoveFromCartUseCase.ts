import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import type { IShoppingCartRepository } from '../../domain/repositories/IShoppingCartRepository';

export class RemoveFromCartUseCase {
  private readonly logger: ILogger;

  constructor(private readonly cartRepository: IShoppingCartRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('RemoveFromCartUseCase');
  }

  /**
   * Remove a single item from the authenticated user's cart.
   *
   * Authorization: the repository verifies item ownership via currentUser.userId.
   * Non-existent items and items belonging to another user both produce a
   * NotFoundError (ambiguous 404) — no enumeration oracle.
   */
  async execute(id: string, currentUser: TokenPayload): Promise<boolean> {
    const result = await this.cartRepository.removeItem(id, currentUser.userId);

    this.logger.info('Cart item removed', {
      cartItemId: id,
      userId: currentUser.userId,
    });

    return result;
  }
}
