import { PrismaClient } from '@prisma/client';
import type { TokenPayload } from '@hbs/auth';
import type { RecordRuleResolver } from '@hbs/authz';
import { assertWriteAccess } from '@hbs/authz';
import {
  IOrderRepository,
  OrderFilters,
  OrderStats,
} from '../../domain/repositories/IOrderRepository';
import {
  Order,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderItem,
  ShippingAddress,
  OrderStatus,
} from '../../domain/entities/Order';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class PrismaOrderRepository implements IOrderRepository {
  private readonly logger: ILogger;

  /**
   * @param prisma - Singleton PrismaClient from @hbs/prisma.
   * @param recordRuleResolver - Optional RecordRuleResolver for applying record-level
   *   access rules on read operations. When absent (e.g. in tests without RBAC),
   *   reads are unrestricted. When present, findAll and findById merge the resolved
   *   `where` clause before querying.
   */
  constructor(
    private readonly prisma: PrismaClient,
    private readonly recordRuleResolver?: RecordRuleResolver,
  ) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaOrderRepository');
  }

  async create(orderData: CreateOrderRequest, total: number): Promise<Order> {
    try {
      const order = await this.prisma.order.create({
        data: {
          userId: orderData.userId,
          orderNumber: this.generateOrderNumber(),
          customerEmail: orderData.customerEmail,
          customerName: orderData.customerName,
          status: 'pending' as OrderStatus,
          subtotal: total,
          taxAmount: 0,
          shippingAmount: 0,
          discountAmount: 0,
          totalAmount: total,
          currency: 'PEN',
          shippingStreet: orderData.shippingAddress.street,
          shippingCity: orderData.shippingAddress.city,
          shippingState: orderData.shippingAddress.state,
          shippingZipCode: orderData.shippingAddress.zipCode,
          shippingCountry: orderData.shippingAddress.country || 'PE',
          notes: '',
        },
        include: { items: true },
      });

      const orderItems = await Promise.all(
        orderData.items.map((item) =>
          this.prisma.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: 0,
              totalPrice: 0,
            },
          }),
        ),
      );

      this.logger.info('Order created', { orderId: order.id });
      return this.mapToOrder(order, orderItems);
    } catch (error) {
      this.logger.error(
        'Error creating order',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findById(id: string, currentUser: TokenPayload | null = null): Promise<Order | null> {
    try {
      // Apply record-level access rule filter for the calling user.
      // resolveWhere returns {} (no restriction) when no rules exist for Order/read,
      // or DENY_WHERE when the user has no matching group rule.
      const ruleWhere = this.recordRuleResolver
        ? await this.recordRuleResolver.resolveWhere('Order', 'read', currentUser)
        : {};

      // Use findFirst with AND[{id}, ruleWhere] instead of findUnique so we can
      // compose the record-rule where clause without Prisma's unique-constraint check.
      const order = await this.prisma.order.findFirst({
        where: { AND: [{ id }, ruleWhere] },
        include: { items: true },
      });
      if (!order) return null;
      return this.mapToOrder(order, order.items);
    } catch (error) {
      this.logger.error(
        'Error finding order',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findAll(filters?: OrderFilters, currentUser?: TokenPayload | null): Promise<Order[]> {
    try {
      const filterWhere: Record<string, unknown> = {};
      if (filters?.status) filterWhere['status'] = filters.status;
      if (filters?.userId) filterWhere['userId'] = filters.userId;
      if (filters?.orderNumber) filterWhere['orderNumber'] = filters.orderNumber;
      if (filters?.customerEmail) filterWhere['customerEmail'] = filters.customerEmail;
      if (filters?.startDate || filters?.endDate) {
        const createdAt: Record<string, Date> = {};
        if (filters.startDate) createdAt['gte'] = filters.startDate;
        if (filters.endDate) createdAt['lte'] = filters.endDate;
        filterWhere['createdAt'] = createdAt;
      }

      // Apply record-level access rule filter for the calling user.
      const ruleWhere = this.recordRuleResolver
        ? await this.recordRuleResolver.resolveWhere('Order', 'read', currentUser ?? null)
        : {};

      // Merge filter conditions and rule-based where using AND.
      const where =
        Object.keys(ruleWhere).length === 0
          ? filterWhere
          : { AND: [filterWhere, ruleWhere] };

      const orders = await this.prisma.order.findMany({
        where: where as any,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit,
        skip: filters?.offset,
      });

      return orders.map((o) => this.mapToOrder(o, o.items));
    } catch (error) {
      this.logger.error(
        'Error finding orders',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Bypasses all record-level access rules.
   *
   * Use ONLY for callers without a user context (event consumers, internal background
   * jobs). NEVER call this from a resolver mutation — use update/delete/updateStatus
   * which enforce write-mode record rules via assertWriteAccess.
   */
  async findByIdUnrestricted(id: string): Promise<Order | null> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) return null;
      return this.mapToOrder(order, order.items);
    } catch (error) {
      this.logger.error(
        'Error finding order (unrestricted)',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async update(
    id: string,
    orderData: UpdateOrderRequest,
    currentUser: TokenPayload | null,
  ): Promise<Order> {
    // Enforce write-mode record rules before mutating.
    // assertWriteAccess throws NotFoundError (ambiguous 404) when the record does
    // not exist OR when the rule denies access — prevents enumeration oracle.
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Order',
      mode: 'write',
      id,
      currentUser,
      exists: (where) =>
        this.prisma.order
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });

    try {
      const updateData: any = {};
      if (orderData.status) updateData.status = orderData.status;
      if (orderData.deliveredAt) updateData.deliveredAt = orderData.deliveredAt;
      if (orderData.customerEmail) updateData.customerEmail = orderData.customerEmail;
      if (orderData.customerName) updateData.customerName = orderData.customerName;

      const updated = await this.prisma.order.update({
        where: { id },
        data: updateData,
        include: { items: true },
      });

      return this.mapToOrder(updated, updated.items);
    } catch (error) {
      this.logger.error(
        'Error updating order',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async delete(id: string, currentUser: TokenPayload | null): Promise<boolean> {
    // Enforce unlink-mode record rules before deleting.
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Order',
      mode: 'unlink',
      id,
      currentUser,
      exists: (where) =>
        this.prisma.order
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });

    try {
      await this.prisma.order.delete({ where: { id } });
      return true;
    } catch (error) {
      this.logger.error(
        'Error deleting order',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findByStatus(status: string, currentUser: TokenPayload | null = null): Promise<Order[]> {
    try {
      // Apply record-level access rule filter — same AND-merge pattern as findAll.
      const ruleWhere = this.recordRuleResolver
        ? await this.recordRuleResolver.resolveWhere('Order', 'read', currentUser)
        : {};

      const statusWhere = { status: status as OrderStatus };
      const where =
        Object.keys(ruleWhere).length === 0
          ? statusWhere
          : { AND: [statusWhere, ruleWhere] };

      const orders = await this.prisma.order.findMany({
        where: where as any,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
      return orders.map((o) => this.mapToOrder(o, o.items));
    } catch (error) {
      this.logger.error(
        'Error finding orders by status',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findByCustomerEmail(email: string): Promise<Order[]> {
    try {
      const orders = await this.prisma.order.findMany({
        where: { customerEmail: email },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
      return orders.map((o) => this.mapToOrder(o, o.items));
    } catch (error) {
      this.logger.error(
        'Error finding orders by email',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async updateStatus(id: string, status: string, currentUser: TokenPayload | null): Promise<Order> {
    // Enforce write-mode record rules before mutating status.
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Order',
      mode: 'write',
      id,
      currentUser,
      exists: (where) =>
        this.prisma.order
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });

    try {
      const updated = await this.prisma.order.update({
        where: { id },
        data: { status: status as OrderStatus },
        include: { items: true },
      });
      return this.mapToOrder(updated, updated.items);
    } catch (error) {
      this.logger.error(
        'Error updating order status',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async addOrderItem(
    orderId: string,
    item: Omit<OrderItem, 'id' | 'orderId' | 'createdAt'>,
  ): Promise<OrderItem> {
    try {
      const created = await this.prisma.orderItem.create({
        data: {
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.price * item.quantity,
        },
      });
      return this.mapToOrderItem(created);
    } catch (error) {
      this.logger.error(
        'Error adding order item',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async removeOrderItem(orderId: string, itemId: string): Promise<boolean> {
    try {
      await this.prisma.orderItem.delete({ where: { id: itemId } });
      return true;
    } catch (error) {
      this.logger.error(
        'Error removing order item',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    try {
      const items = await this.prisma.orderItem.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });
      return items.map((i) => this.mapToOrderItem(i));
    } catch (error) {
      this.logger.error(
        'Error getting order items',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async createShippingAddress(addressData: Omit<ShippingAddress, 'id'>): Promise<ShippingAddress> {
    return {
      id: 'inline',
      street: addressData.street,
      city: addressData.city,
      state: addressData.state,
      zipCode: addressData.zipCode,
      country: addressData.country,
    };
  }

  async getShippingAddress(id: string): Promise<ShippingAddress | null> {
    try {
      const order = await this.prisma.order.findFirst({
        where: { shippingAddressId: id },
      });
      if (!order || !order.shippingStreet) return null;
      return this.buildShippingAddress(order);
    } catch (error) {
      this.logger.error(
        'Error getting shipping address',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async getOrderStats(): Promise<OrderStats> {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [total, pending, processing, shipped, delivered, cancelled, revenue, avg, todayCount, todayRevenue, activeCoupons] =
        await Promise.all([
          this.prisma.order.count(),
          this.prisma.order.count({ where: { status: 'pending' } }),
          this.prisma.order.count({ where: { status: 'processing' } }),
          this.prisma.order.count({ where: { status: 'shipped' } }),
          this.prisma.order.count({ where: { status: 'delivered' } }),
          this.prisma.order.count({ where: { status: 'cancelled' } }),
          this.prisma.order.aggregate({ _sum: { totalAmount: true } }),
          this.prisma.order.aggregate({ _avg: { totalAmount: true } }),
          this.prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
          this.prisma.order.aggregate({ where: { createdAt: { gte: startOfToday } }, _sum: { totalAmount: true } }),
          this.prisma.coupon.count({ where: { isActive: true, validUntil: { gte: new Date() } } }),
        ]);

      return {
        totalOrders: total,
        pendingOrders: pending,
        processingOrders: processing,
        shippedOrders: shipped,
        deliveredOrders: delivered,
        cancelledOrders: cancelled,
        totalRevenue: Number(revenue._sum.totalAmount) || 0,
        averageOrderValue: Number(avg._avg.totalAmount) || 0,
        todayOrders: todayCount,
        todayRevenue: Number(todayRevenue._sum.totalAmount) || 0,
        activeCoupons,
      };
    } catch (error) {
      this.logger.error(
        'Error calculating order stats',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Verify write/unlink access on an order BEFORE any prefetch or business logic.
   *
   * Throws NotFoundError (ambiguous 404) when the order does not exist OR when
   * a record rule denies access — same semantics as assertWriteAccess inside
   * update/delete. This is intentionally a thin wrapper so the use case can
   * call it as its very first line, ensuring no information leaks via business
   * logic errors (e.g. invalid status transition) before the auth gate fires.
   *
   * Defence-in-depth: repo.update/delete still run their own assertWriteAccess
   * internally. The double probe is acceptable (and preferable to removing the
   * inner guard which would break callers that skip ensureWritable).
   */
  async ensureWritable(
    id: string,
    mode: 'write' | 'unlink',
    currentUser: TokenPayload | null,
  ): Promise<void> {
    await assertWriteAccess({
      resolver: this.recordRuleResolver,
      modelName: 'Order',
      mode,
      id,
      currentUser,
      exists: (where) =>
        this.prisma.order
          .findFirst({ where: where as any, select: { id: true } })
          .then(Boolean),
    });
  }

  async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
    try {
      const orders = await this.prisma.order.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
      return orders.map((o) => this.mapToOrder(o, o.items));
    } catch (error) {
      this.logger.error(
        'Error finding orders by date range',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `ORD-${timestamp}-${random}`.toUpperCase();
  }

  private buildShippingAddress(order: any): ShippingAddress {
    return {
      id: order.shippingAddressId || order.id,
      street: order.shippingStreet || '',
      city: order.shippingCity || '',
      state: order.shippingState || '',
      zipCode: order.shippingZipCode || '',
      country: order.shippingCountry || 'PE',
    };
  }

  private mapToOrder(prismaOrder: any, items: any[]): Order {
    return {
      id: prismaOrder.id,
      userId: prismaOrder.userId,
      orderNumber: prismaOrder.orderNumber,
      customerEmail: prismaOrder.customerEmail || '',
      customerName: prismaOrder.customerName || '',
      status: prismaOrder.status as OrderStatus,
      subtotal: Number(prismaOrder.subtotal),
      taxAmount: Number(prismaOrder.taxAmount),
      shippingAmount: Number(prismaOrder.shippingAmount),
      discountAmount: Number(prismaOrder.discountAmount),
      totalAmount: Number(prismaOrder.totalAmount),
      currency: prismaOrder.currency,
      shippingAddressId: prismaOrder.shippingAddressId || undefined,
      notes: prismaOrder.notes || undefined,
      createdAt: prismaOrder.createdAt,
      updatedAt: prismaOrder.updatedAt,
      deliveredAt: prismaOrder.deliveredAt || undefined,
      items: (items || []).map((i) => this.mapToOrderItem(i)),
      shippingAddress: prismaOrder.shippingStreet
        ? this.buildShippingAddress(prismaOrder)
        : undefined,
    };
  }

  private mapToOrderItem(prismaItem: any): OrderItem {
    return {
      id: prismaItem.id,
      orderId: prismaItem.orderId,
      productId: prismaItem.productId,
      quantity: prismaItem.quantity,
      price: Number(prismaItem.unitPrice),
      createdAt: prismaItem.createdAt,
    };
  }
}
