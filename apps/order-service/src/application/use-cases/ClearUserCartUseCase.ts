import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import type { IShoppingCartRepository } from '../../domain/repositories/IShoppingCartRepository';

export class ClearUserCartUseCase {
  private readonly logger: ILogger;

  constructor(private readonly cartRepository: IShoppingCartRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('ClearUserCartUseCase');
  }

  /**
   * Clear all items from the authenticated user's cart.
   *
   * The userId is ALWAYS derived from currentUser.userId (JWT) — never from
   * client input. This prevents BOLA where an attacker could clear another
   * user's cart by supplying a different userId in the request.
   */
  async execute(currentUser: TokenPayload): Promise<boolean> {
    const result = await this.cartRepository.clearCart(currentUser.userId);

    this.logger.info('User cart cleared', { userId: currentUser.userId });

    return result;
  }
}
