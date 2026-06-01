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
   * Use ONLY in write-path operations (update, delete) where the authorization check
   * has already been performed at the resolver layer (requirePermission/requireRole).
   * NEVER use this for read-path queries exposed to clients.
   */
  findByIdUnrestricted(id: string): Promise<Order | null>;
  /**
   * List orders with optional filters, applying record-level access rules for currentUser.
   * @param currentUser - null for unauthenticated callers (will be denied by any rule).
   * TODO (Fase futura): apply record rules to all remaining methods below.
   */
  findAll(filters?: OrderFilters, currentUser?: TokenPayload | null): Promise<Order[]>;
  update(id: string, orderData: UpdateOrderRequest): Promise<Order>;
  delete(id: string): Promise<boolean>;
  findByStatus(status: string): Promise<Order[]>;
  findByCustomerEmail(email: string): Promise<Order[]>;
  updateStatus(id: string, status: string): Promise<Order>;
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
