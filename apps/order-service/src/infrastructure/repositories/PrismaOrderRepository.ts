import { PrismaClient } from '@prisma/client';
import { IOrderRepository, OrderFilters, OrderStats } from '../../domain/repositories/IOrderRepository';
import { Order, CreateOrderRequest, UpdateOrderRequest, OrderItem, ShippingAddress, OrderStatus } from '../../domain/entities/Order';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class PrismaOrderRepository implements IOrderRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaOrderRepository');
  }

  async create(orderData: CreateOrderRequest, total: number, userId?: string): Promise<Order> {
    try {
      const shippingAddress = await this.prisma.userAddress.create({
        data: {
          userId: userId || 'guest',
          type: 'shipping',
          firstName: orderData.customerName.split(' ')[0] || 'Customer',
          lastName: orderData.customerName.split(' ').slice(1).join(' ') || '',
          address1: orderData.shippingAddress.street,
          city: orderData.shippingAddress.city,
          state: orderData.shippingAddress.state,
          postalCode: orderData.shippingAddress.zipCode,
          country: orderData.shippingAddress.country || 'PE'
        }
      });

      const order = await this.prisma.order.create({
        data: {
          userId: userId || 'guest',
          orderNumber: this.generateOrderNumber(),
          status: 'pending' as OrderStatus,
          subtotal: total,
          taxAmount: 0,
          shippingAmount: 0,
          discountAmount: 0,
          totalAmount: total,
          currency: 'PEN',
          shippingAddressId: shippingAddress.id,
          notes: ''
        },
        include: { items: true, shippingAddress: true, user: true }
      });

      const orderItems = await Promise.all(
        orderData.items.map(item =>
          this.prisma.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: 0,
              totalPrice: 0
            }
          })
        )
      );

      this.logger.info('Order created', { orderId: order.id });
      return this.mapToOrder(order, orderItems, shippingAddress);
    } catch (error) {
      this.logger.error('Error creating order', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async findById(id: string): Promise<Order | null> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: { items: true, shippingAddress: true, user: true }
      });
      if (!order) return null;
      return this.mapToOrder(order, order.items, order.shippingAddress);
    } catch (error) {
      this.logger.error('Error finding order', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async findAll(filters?: OrderFilters): Promise<Order[]> {
    try {
      const where: any = {};
      if (filters?.status) where.status = filters.status;
      if (filters?.userId) where.userId = filters.userId;
      if (filters?.orderNumber) where.orderNumber = filters.orderNumber;
      if (filters?.customerEmail) where.user = { email: filters.customerEmail };
      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }

      const orders = await this.prisma.order.findMany({
        where,
        include: { items: true, shippingAddress: true, user: true },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit,
        skip: filters?.offset
      });

      return orders.map(o => this.mapToOrder(o, o.items, o.shippingAddress));
    } catch (error) {
      this.logger.error('Error finding orders', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async update(id: string, orderData: UpdateOrderRequest): Promise<Order> {
    try {
      const updateData: any = {};
      if (orderData.status) updateData.status = orderData.status;
      if (orderData.deliveredAt) updateData.deliveredAt = orderData.deliveredAt;

      const updated = await this.prisma.order.update({
        where: { id },
        data: updateData,
        include: { items: true, shippingAddress: true, user: true }
      });

      return this.mapToOrder(updated, updated.items, updated.shippingAddress);
    } catch (error) {
      this.logger.error('Error updating order', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.order.delete({ where: { id } });
      return true;
    } catch (error) {
      this.logger.error('Error deleting order', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async findByStatus(status: string): Promise<Order[]> {
    try {
      const orders = await this.prisma.order.findMany({
        where: { status: status as OrderStatus },
        include: { items: true, shippingAddress: true, user: true },
        orderBy: { createdAt: 'desc' }
      });
      return orders.map(o => this.mapToOrder(o, o.items, o.shippingAddress));
    } catch (error) {
      this.logger.error('Error finding orders by status', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async findByCustomerEmail(email: string): Promise<Order[]> {
    try {
      const orders = await this.prisma.order.findMany({
        where: { user: { email } },
        include: { items: true, shippingAddress: true, user: true },
        orderBy: { createdAt: 'desc' }
      });
      return orders.map(o => this.mapToOrder(o, o.items, o.shippingAddress));
    } catch (error) {
      this.logger.error('Error finding orders by email', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async updateStatus(id: string, status: string): Promise<Order> {
    try {
      const updated = await this.prisma.order.update({
        where: { id },
        data: { status: status as OrderStatus },
        include: { items: true, shippingAddress: true, user: true }
      });
      return this.mapToOrder(updated, updated.items, updated.shippingAddress);
    } catch (error) {
      this.logger.error('Error updating order status', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async addOrderItem(orderId: string, item: Omit<OrderItem, 'id' | 'orderId' | 'createdAt'>): Promise<OrderItem> {
    try {
      const created = await this.prisma.orderItem.create({
        data: {
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.price * item.quantity
        }
      });
      return this.mapToOrderItem(created);
    } catch (error) {
      this.logger.error('Error adding order item', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async removeOrderItem(orderId: string, itemId: string): Promise<boolean> {
    try {
      await this.prisma.orderItem.delete({ where: { id: itemId } });
      return true;
    } catch (error) {
      this.logger.error('Error removing order item', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    try {
      const items = await this.prisma.orderItem.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' }
      });
      return items.map(i => this.mapToOrderItem(i));
    } catch (error) {
      this.logger.error('Error getting order items', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async createShippingAddress(addressData: Omit<ShippingAddress, 'id'>): Promise<ShippingAddress> {
    try {
      const created = await this.prisma.userAddress.create({
        data: {
          userId: 'guest',
          type: 'shipping',
          firstName: addressData.street.split(' ')[0] || 'Customer',
          lastName: '',
          address1: addressData.street,
          city: addressData.city,
          state: addressData.state,
          postalCode: addressData.zipCode,
          country: addressData.country
        }
      });
      return this.mapToShippingAddress(created);
    } catch (error) {
      this.logger.error('Error creating shipping address', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getShippingAddress(id: string): Promise<ShippingAddress | null> {
    try {
      const address = await this.prisma.userAddress.findUnique({ where: { id } });
      if (!address) return null;
      return this.mapToShippingAddress(address);
    } catch (error) {
      this.logger.error('Error getting shipping address', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getOrderStats(): Promise<OrderStats> {
    try {
      const [total, pending, processing, shipped, delivered, cancelled, revenue, avg] = await Promise.all([
        this.prisma.order.count(),
        this.prisma.order.count({ where: { status: 'pending' } }),
        this.prisma.order.count({ where: { status: 'processing' } }),
        this.prisma.order.count({ where: { status: 'shipped' } }),
        this.prisma.order.count({ where: { status: 'delivered' } }),
        this.prisma.order.count({ where: { status: 'cancelled' } }),
        this.prisma.order.aggregate({ _sum: { totalAmount: true } }),
        this.prisma.order.aggregate({ _avg: { totalAmount: true } })
      ]);

      return {
        totalOrders: total,
        pendingOrders: pending,
        processingOrders: processing,
        shippedOrders: shipped,
        deliveredOrders: delivered,
        cancelledOrders: cancelled,
        totalRevenue: Number(revenue._sum.totalAmount) || 0,
        averageOrderValue: Number(avg._avg.totalAmount) || 0
      };
    } catch (error) {
      this.logger.error('Error calculating order stats', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
    try {
      const orders = await this.prisma.order.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        include: { items: true, shippingAddress: true, user: true },
        orderBy: { createdAt: 'desc' }
      });
      return orders.map(o => this.mapToOrder(o, o.items, o.shippingAddress));
    } catch (error) {
      this.logger.error('Error finding orders by date range', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `ORD-${timestamp}-${random}`.toUpperCase();
  }

  private mapToOrder(prismaOrder: any, items: any[], shippingAddress: any): Order {
    return {
      id: prismaOrder.id,
      userId: prismaOrder.userId,
      orderNumber: prismaOrder.orderNumber,
      customerEmail: prismaOrder.user?.email || '',
      customerName: `${prismaOrder.user?.firstName || ''} ${prismaOrder.user?.lastName || ''}`.trim(),
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
      items: (items || []).map(i => this.mapToOrderItem(i)),
      shippingAddress: shippingAddress ? this.mapToShippingAddress(shippingAddress) : undefined
    };
  }

  private mapToOrderItem(prismaItem: any): OrderItem {
    return {
      id: prismaItem.id,
      orderId: prismaItem.orderId,
      productId: prismaItem.productId,
      quantity: prismaItem.quantity,
      price: Number(prismaItem.unitPrice),
      createdAt: prismaItem.createdAt
    };
  }

  private mapToShippingAddress(prismaAddress: any): ShippingAddress {
    return {
      id: prismaAddress.id,
      street: prismaAddress.address1,
      city: prismaAddress.city,
      state: prismaAddress.state,
      zipCode: prismaAddress.postalCode,
      country: prismaAddress.country
    };
  }
}
