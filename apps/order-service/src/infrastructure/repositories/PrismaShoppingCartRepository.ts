import { PrismaClient } from '@prisma/client';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type {
  IShoppingCartRepository,
  ShoppingCartItemData,
  ShoppingCartData,
} from '../../domain/repositories/IShoppingCartRepository';

export class PrismaShoppingCartRepository implements IShoppingCartRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger(
      'PrismaShoppingCartRepository',
    );
  }

  // ---------------------------------------------------------------------------
  // Read queries (for guarded query resolvers)
  // ---------------------------------------------------------------------------

  async findByUserId(userId: string): Promise<ShoppingCartData[]> {
    try {
      const carts = await this.prisma.shoppingCart.findMany({
        where: { userId },
        include: { items: true },
      });
      return carts.map((c) => ({
        id: c.id,
        userId: c.userId,
        sessionId: c.sessionId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        items: c.items.map((i) => this.mapToData(i)),
      }));
    } catch (error) {
      this.logger.error(
        'Error finding ShoppingCarts by userId',
        error instanceof Error ? error : new Error(String(error)),
        { userId },
      );
      throw error;
    }
  }

  async findItemById(
    id: string,
  ): Promise<ShoppingCartItemData & { cartUserId: string | null } | null> {
    try {
      const item = await this.prisma.shoppingCartItem.findUnique({
        where: { id },
        include: { cart: { select: { userId: true } } },
      });
      if (!item) return null;
      return { ...this.mapToData(item), cartUserId: item.cart.userId };
    } catch (error) {
      this.logger.error(
        'Error finding ShoppingCartItem by id',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // addItem
  // ---------------------------------------------------------------------------

  async addItem(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<ShoppingCartItemData> {
    try {
      // Find or create the user's cart (keyed by userId from JWT — never from input).
      let cart = await this.prisma.shoppingCart.findFirst({ where: { userId } });
      if (!cart) {
        cart = await this.prisma.shoppingCart.create({ data: { userId } });
        this.logger.info('ShoppingCart created', { userId, cartId: cart.id });
      }

      // Upsert: increment existing item quantity if already in cart.
      const existing = await this.prisma.shoppingCartItem.findFirst({
        where: { cartId: cart.id, productId },
      });

      if (existing) {
        const updated = await this.prisma.shoppingCartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + quantity },
        });
        this.logger.info('Cart item quantity incremented', {
          cartItemId: updated.id,
          userId,
          productId,
        });
        return this.mapToData(updated);
      }

      const item = await this.prisma.shoppingCartItem.create({
        data: { cartId: cart.id, productId, quantity, price: 0 },
      });
      this.logger.info('Cart item created', { cartItemId: item.id, userId, productId });
      return this.mapToData(item);
    } catch (error) {
      this.logger.error(
        'Error adding item to cart',
        error instanceof Error ? error : new Error(String(error)),
        { userId, productId },
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // updateItem — owner-gated
  // ---------------------------------------------------------------------------

  async updateItem(id: string, userId: string, quantity: number): Promise<ShoppingCartItemData> {
    try {
      // Load the item with its parent cart to verify ownership.
      const item = await this.prisma.shoppingCartItem.findUnique({
        where: { id },
        include: { cart: { select: { userId: true } } },
      });

      // Ambiguous 404: conflates "not found" and "not owner" to prevent enumeration oracle.
      if (!item || item.cart.userId !== userId) {
        throw new NotFoundError('ShoppingCartItem', id);
      }

      const updated = await this.prisma.shoppingCartItem.update({
        where: { id },
        data: { quantity },
      });
      this.logger.info('Cart item updated', { cartItemId: id, userId });
      return this.mapToData(updated);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      this.logger.error(
        'Error updating cart item',
        error instanceof Error ? error : new Error(String(error)),
        { id, userId },
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // removeItem — owner-gated
  // ---------------------------------------------------------------------------

  async removeItem(id: string, userId: string): Promise<boolean> {
    try {
      // Verify ownership before deletion.
      const item = await this.prisma.shoppingCartItem.findUnique({
        where: { id },
        include: { cart: { select: { userId: true } } },
      });

      // Ambiguous 404: same BOLA mitigation pattern as updateItem.
      if (!item || item.cart.userId !== userId) {
        throw new NotFoundError('ShoppingCartItem', id);
      }

      await this.prisma.shoppingCartItem.delete({ where: { id } });
      this.logger.info('Cart item removed', { cartItemId: id, userId });
      return true;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      this.logger.error(
        'Error removing cart item',
        error instanceof Error ? error : new Error(String(error)),
        { id, userId },
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // clearCart
  // ---------------------------------------------------------------------------

  async clearCart(userId: string): Promise<boolean> {
    try {
      const carts = await this.prisma.shoppingCart.findMany({ where: { userId } });
      for (const cart of carts) {
        await this.prisma.shoppingCartItem.deleteMany({ where: { cartId: cart.id } });
      }
      this.logger.info('User cart cleared', { userId, cartCount: carts.length });
      return true;
    } catch (error) {
      this.logger.error(
        'Error clearing user cart',
        error instanceof Error ? error : new Error(String(error)),
        { userId },
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Mapper
  // ---------------------------------------------------------------------------

  private mapToData(item: any): ShoppingCartItemData {
    return {
      id: item.id,
      cartId: item.cartId,
      productId: item.productId,
      quantity: item.quantity,
      price: Number(item.price),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
