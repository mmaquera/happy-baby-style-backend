import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import type {
  IShoppingCartRepository,
  ShoppingCartItemData,
} from '../../domain/repositories/IShoppingCartRepository';

export class AddToCartUseCase {
  private readonly logger: ILogger;

  constructor(private readonly cartRepository: IShoppingCartRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('AddToCartUseCase');
  }

  /**
   * Add a product to the authenticated user's cart.
   *
   * Authorization: the userId is ALWAYS derived from the JWT (currentUser.userId)
   * and never accepted from client input. This prevents BOLA where one user could
   * add items to another user's cart by supplying a different userId.
   */
  async execute(
    productId: string,
    quantity: number,
    currentUser: TokenPayload,
  ): Promise<ShoppingCartItemData> {
    const item = await this.cartRepository.addItem(currentUser.userId, productId, quantity);

    this.logger.info('Item added to cart', {
      userId: currentUser.userId,
      productId,
      quantity,
      cartItemId: item.id,
    });

    return item;
  }
}
