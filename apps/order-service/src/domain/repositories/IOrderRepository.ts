import type { TokenPayload } from '@hbs/auth';
import {
  Order,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderItem,
  ShippingAddress,
} from '../entities/Order';

export interface IOrderRepository {
  create(orderData: CreateOrderRequest, total: number): Promise<Order>;
  /**
   * Find a single order by id, applying record-level access rules for currentUser.
   * Returns null if the order does not exist OR if rules deny access for this user.
   * @param currentUser - null for unauthenticated callers (will be denied by any rule).
   */
  findById(id: string, currentUser: TokenPayload | null): Promise<Order | null>;
  /**
   * Find a single order by id WITHOUT applying record-level access rules.
   *
   * Use ONLY for callers that have no user context (e.g. event consumers, internal
   * background jobs). NEVER call this from a resolver mutation — mutations must use
   * update/delete/updateStatus which enforce write-mode record rules via assertWriteAccess.
   */
  findByIdUnrestricted(id: string): Promise<Order | null>;
  /**
   * List orders with optional filters, applying record-level access rules for currentUser.
   * @param currentUser - null for unauthenticated callers (will be denied by any rule).
   */
  findAll(filters?: OrderFilters, currentUser?: TokenPayload | null): Promise<Order[]>;
  /**
   * Update an order, enforcing write-mode record rules for currentUser.
   * Throws NotFoundError (ambiguous 404) when the record does not exist OR when
   * a write-mode rule denies access for this user.
   * @param currentUser - null for callers without user context (event consumers, jobs).
   */
  update(id: string, orderData: UpdateOrderRequest, currentUser: TokenPayload | null): Promise<Order>;
  /**
   * Delete an order, enforcing unlink-mode record rules for currentUser.
   * Throws NotFoundError (ambiguous 404) when the record does not exist OR when
   * an unlink-mode rule denies access for this user.
   * @param currentUser - null for callers without user context (event consumers, jobs).
   */
  delete(id: string, currentUser: TokenPayload | null): Promise<boolean>;
  /**
   * List orders by status, applying record-level access rules for currentUser.
   * @param currentUser - null for unauthenticated callers (will be denied by any rule).
   */
  findByStatus(status: string, currentUser: TokenPayload | null): Promise<Order[]>;
  findByCustomerEmail(email: string): Promise<Order[]>;
  /**
   * Update only the status field of an order, enforcing write-mode record rules for currentUser.
   * Throws NotFoundError (ambiguous 404) when the record does not exist OR when
   * a write-mode rule denies access for this user.
   * @param currentUser - null for callers without user context (event consumers, jobs).
   */
  updateStatus(id: string, status: string, currentUser: TokenPayload | null): Promise<Order>;
  addOrderItem(
    orderId: string,
    item: Omit<OrderItem, 'id' | 'orderId' | 'createdAt'>,
  ): Promise<OrderItem>;
  removeOrderItem(orderId: string, itemId: string): Promise<boolean>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createShippingAddress(addressData: Omit<ShippingAddress, 'id'>): Promise<ShippingAddress>;
  getShippingAddress(id: string): Promise<ShippingAddress | null>;
  getOrderStats(): Promise<OrderStats>;
  getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]>;
  /**
   * Verify that the order is accessible for the given user in the specified mode
   * (write or unlink) before any prefetch or business logic runs.
   *
   * Throws NotFoundError (ambiguous 404) when the order does not exist OR when
   * a write/unlink-mode record rule denies access for this user.
   *
   * Use as the FIRST call in any use case that writes to an order, so that
   * no business-logic errors (state transition, etc.) can leak order existence
   * information before the authorization gate is applied.
   *
   * @param id          - Order id to check.
   * @param mode        - 'write' for updates; 'unlink' for deletions.
   * @param currentUser - Authenticated user; null for internal callers without context.
   */
  ensureWritable(id: string, mode: 'write' | 'unlink', currentUser: TokenPayload | null): Promise<void>;
}

export interface OrderFilters {
  status?: string;
  customerEmail?: string;
  userId?: string;
  orderNumber?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  todayOrders: number;
  todayRevenue: number;
  activeCoupons: number;
}
