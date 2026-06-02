/**
 * IShoppingCartRepository — port for shopping cart persistence.
 *
 * Ownership contract:
 *   - The identity of the cart owner ALWAYS comes from the authenticated JWT
 *     (TokenPayload.userId). It is NEVER accepted from client input.
 *   - updateItem and removeItem verify that the item belongs to the owner's
 *     cart before mutating. Violations return NotFoundError (ambiguous 404) to
 *     prevent resource-existence enumeration (BOLA mitigation).
 */

export interface ShoppingCartItemData {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShoppingCartData {
  id: string;
  userId: string | null;
  sessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: ShoppingCartItemData[];
}

export interface IShoppingCartRepository {
  /**
   * Find all carts (with items) for a given userId.
   * Callers must apply owner-or-management guard before invoking.
   *
   * @param userId - The user whose carts to retrieve.
   */
  findByUserId(userId: string): Promise<ShoppingCartData[]>;

  /**
   * Find a single cart item by id.
   * Returns null when not found.
   * Does NOT enforce ownership — callers must apply owner-or-management check.
   */
  findItemById(id: string): Promise<ShoppingCartItemData & { cartUserId: string | null } | null>;

  /**
   * Upsert: find or create the active cart for userId, then add or increment
   * the item. Returns the resulting ShoppingCartItem.
   *
   * @param userId - MUST come from JWT, never from client input.
   */
  addItem(userId: string, productId: string, quantity: number): Promise<ShoppingCartItemData>;

  /**
   * Update the quantity of a cart item.
   * Verifies that the item belongs to a cart owned by userId.
   * Returns NotFoundError when the item does not exist OR does not belong to userId.
   *
   * @param id      - ID of the ShoppingCartItem to update.
   * @param userId  - MUST come from JWT.
   * @param quantity - New quantity value.
   */
  updateItem(id: string, userId: string, quantity: number): Promise<ShoppingCartItemData>;

  /**
   * Delete a cart item.
   * Verifies that the item belongs to a cart owned by userId.
   * Returns NotFoundError when the item does not exist OR does not belong to userId.
   *
   * @param id     - ID of the ShoppingCartItem to remove.
   * @param userId - MUST come from JWT.
   */
  removeItem(id: string, userId: string): Promise<boolean>;

  /**
   * Delete all items from all carts owned by userId.
   *
   * @param userId - MUST come from JWT.
   */
  clearCart(userId: string): Promise<boolean>;
}
