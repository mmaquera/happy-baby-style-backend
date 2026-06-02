import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import { GraphQLError } from 'graphql';
import type {
  IShoppingCartRepository,
  ShoppingCartData,
  ShoppingCartItemData,
} from '../../domain/repositories/IShoppingCartRepository';
import {
  assertOwnerOrOrderManagement,
  hasOrderManagementAccess,
} from './guards/orderAuthGuards';

export class GetUserCartUseCase {
  private readonly logger: ILogger;

  constructor(private readonly cartRepository: IShoppingCartRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetUserCartUseCase');
  }

  /**
   * Returns all carts for the target user.
   * Owner sees their own carts; management sees any user's carts.
   * Throws UNAUTHENTICATED or FORBIDDEN per the owner-or-management policy.
   */
  async execute(
    targetUserId: string,
    currentUser: TokenPayload | null,
  ): Promise<ShoppingCartData[]> {
    assertOwnerOrOrderManagement(currentUser, targetUserId);

    const results = await this.cartRepository.findByUserId(targetUserId);
    this.logger.info('User cart retrieved', {
      targetUserId,
      requesterId: currentUser!.userId,
      cartCount: results.length,
    });
    return results;
  }
}

export class GetCartItemByIdUseCase {
  private readonly logger: ILogger;

  constructor(private readonly cartRepository: IShoppingCartRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetCartItemByIdUseCase');
  }

  /**
   * Returns the cart item if the caller is the owner or has management access.
   * Returns NotFoundError (ambiguous 404) when the resource does not exist or
   * the caller is not the owner and lacks management access.
   * Prevents existence-enumeration (BOLA / CWE-639).
   */
  async execute(
    id: string,
    currentUser: TokenPayload | null,
  ): Promise<ShoppingCartItemData> {
    if (!currentUser) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
      });
    }

    const item = await this.cartRepository.findItemById(id);

    // Ambiguous 404: not found or denied → same response surface.
    if (!item) {
      throw new NotFoundError('ShoppingCartItem', id);
    }

    // cartUserId can be null for session-only (anonymous) carts.
    // A null cartUserId never matches a JWT userId (always a non-null string),
    // so non-management callers receive NotFoundError for session carts — this is
    // intentional: authenticated carts always have a userId set via addItem().
    // Management users can still access session cart items (for admin inspection).
    const isOwner = item.cartUserId !== null && item.cartUserId === currentUser.userId;
    if (!isOwner && !hasOrderManagementAccess(currentUser)) {
      throw new NotFoundError('ShoppingCartItem', id);
    }

    this.logger.info('ShoppingCartItem retrieved by id', {
      cartItemId: id,
      requesterId: currentUser.userId,
    });
    return item;
  }
}
