import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import type {
  IShoppingCartRepository,
  ShoppingCartItemData,
} from '../../domain/repositories/IShoppingCartRepository';

export class UpdateCartItemUseCase {
  private readonly logger: ILogger;

  constructor(private readonly cartRepository: IShoppingCartRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateCartItemUseCase');
  }

  /**
   * Update the quantity of a cart item.
   *
   * Authorization: the repository verifies that the item belongs to a cart
   * owned by currentUser.userId. If the item does not exist OR belongs to
   * another user, NotFoundError is thrown (ambiguous 404 — no enumeration oracle).
   */
  async execute(
    id: string,
    quantity: number,
    currentUser: TokenPayload,
  ): Promise<ShoppingCartItemData> {
    const item = await this.cartRepository.updateItem(id, currentUser.userId, quantity);

    this.logger.info('Cart item quantity updated', {
      cartItemId: id,
      userId: currentUser.userId,
      quantity,
    });

    return item;
  }
}
