import { PrismaClient } from '@prisma/client';
import { IOrderRepository, OrderFilters, OrderStats } from '@domain/repositories/IOrderRepository';
import { Order, CreateOrderRequest, UpdateOrderRequest, OrderItem, ShippingAddress } from '@domain/entities/Order';
import { ILogger } from '@domain/interfaces/ILogger';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';

export class PrismaOrderRepository implements IOrderRepository {
  private readonly logger: ILogger;

  constructor(private prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaOrderRepository');
  }

  async create(orderData: CreateOrderRequest): Promise<Order> {
    try {
      const createdOrder = await this.prisma.order.create({
        data: {
          orderNumber: orderData.orderNumber,
          userId: orderData.userId,
          status: orderData.status,
          totalAmount: orderData.totalAmount,
          currency: orderData.currency,
          paymentMethod: orderData.paymentMethod,
          shippingMethod: orderData.shippingMethod,
          notes: orderData.notes,
          items: {
            create: orderData.items?.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              variantId: item.variantId,
            })) || [],
          },
          shippingAddress: orderData.shippingAddress ? {
            create: {
              firstName: orderData.shippingAddress.firstName,
              lastName: orderData.shippingAddress.lastName,
              addressLine1: orderData.shippingAddress.addressLine1,
              addressLine2: orderData.shippingAddress.addressLine2,
              city: orderData.shippingAddress.city,
              state: orderData.shippingAddress.state,
              postalCode: orderData.shippingAddress.postalCode,
              country: orderData.shippingAddress.country,
              phone: orderData.shippingAddress.phone,
            },
          } : undefined,
        },
        include: {
          items: true,
          shippingAddress: true,
          user: true,
        },
      });

      this.logger.info('Order created successfully', { orderId: createdOrder.id });
      return this.mapToOrderEntity(createdOrder);
    } catch (error) {
      this.logger.error('Error creating order', { error, orderData });
      throw error;
    }
  }

  async findById(id: string): Promise<Order | null> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: {
          items: true,
          shippingAddress: true,
          user: true,
        },
      });

      if (!order) {
        this.logger.debug('Order not found', { orderId: id });
        return null;
      }

      return this.mapToOrderEntity(order);
    } catch (error) {
      this.logger.error('Error finding order by id', { error, orderId: id });
      throw error;
    }
  }

  async findAll(filters?: OrderFilters): Promise<Order[]> {
    try {
      const where: any = {};

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.customerEmail) {
        where.user = {
          email: filters.customerEmail,
        };
      }

      if (filters?.userId) {
        where.userId = filters.userId;
      }

      if (filters?.orderNumber) {
        where.orderNumber = filters.orderNumber;
      }

      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
          where.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.createdAt.lte = filters.endDate;
        }
      }

      const orders = await this.prisma.order.findMany({
        where,
        include: {
          items: true,
          shippingAddress: true,
          user: true,
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit,
        skip: filters?.offset,
      });

      this.logger.debug('Orders found', { count: orders.length, filters });
      return orders.map(order => this.mapToOrderEntity(order));
    } catch (error) {
      this.logger.error('Error finding orders', { error, filters });
      throw error;
    }
  }

  async update(id: string, orderData: UpdateOrderRequest): Promise<Order> {
    try {
      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: {
          status: orderData.status,
          totalAmount: orderData.totalAmount,
          notes: orderData.notes,
        },
        include: {
          items: true,
          shippingAddress: true,
          user: true,
        },
      });

      this.logger.info('Order updated successfully', { orderId: id });
      return this.mapToOrderEntity(updatedOrder);
    } catch (error) {
      this.logger.error('Error updating order', { error, orderId: id, orderData });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.order.delete({
        where: { id },
      });

      this.logger.info('Order deleted successfully', { orderId: id });
      return true;
    } catch (error) {
      this.logger.error('Error deleting order', { error, orderId: id });
      throw error;
    }
  }

  async findByStatus(status: string): Promise<Order[]> {
    try {
      const orders = await this.prisma.order.findMany({
        where: { status },
        include: {
          items: true,
          shippingAddress: true,
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug('Orders found by status', { status, count: orders.length });
      return orders.map(order => this.mapToOrderEntity(order));
    } catch (error) {
      this.logger.error('Error finding orders by status', { error, status });
      throw error;
    }
  }

  async findByCustomerEmail(email: string): Promise<Order[]> {
    try {
      const orders = await this.prisma.order.findMany({
        where: {
          user: {
            email,
          },
        },
        include: {
          items: true,
          shippingAddress: true,
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug('Orders found by customer email', { email, count: orders.length });
      return orders.map(order => this.mapToOrderEntity(order));
    } catch (error) {
      this.logger.error('Error finding orders by customer email', { error, email });
      throw error;
    }
  }

  async updateStatus(id: string, status: string): Promise<Order> {
    try {
      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: { status },
        include: {
          items: true,
          shippingAddress: true,
          user: true,
        },
      });

      this.logger.info('Order status updated successfully', { orderId: id, status });
      return this.mapToOrderEntity(updatedOrder);
    } catch (error) {
      this.logger.error('Error updating order status', { error, orderId: id, status });
      throw error;
    }
  }

  async addOrderItem(orderId: string, item: Omit<OrderItem, 'id' | 'orderId' | 'createdAt'>): Promise<OrderItem> {
    try {
      const createdItem = await this.prisma.orderItem.create({
        data: {
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          variantId: item.variantId,
        },
      });

      this.logger.info('Order item added successfully', { orderId, itemId: createdItem.id });
      return this.mapToOrderItemEntity(createdItem);
    } catch (error) {
      this.logger.error('Error adding order item', { error, orderId, item });
      throw error;
    }
  }

  async removeOrderItem(orderId: string, itemId: string): Promise<boolean> {
    try {
      await this.prisma.orderItem.delete({
        where: { id: itemId },
      });

      this.logger.info('Order item removed successfully', { orderId, itemId });
      return true;
    } catch (error) {
      this.logger.error('Error removing order item', { error, orderId, itemId });
      throw error;
    }
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    try {
      const items = await this.prisma.orderItem.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });

      this.logger.debug('Order items found', { orderId, count: items.length });
      return items.map(item => this.mapToOrderItemEntity(item));
    } catch (error) {
      this.logger.error('Error getting order items', { error, orderId });
      throw error;
    }
  }

  async createShippingAddress(addressData: Omit<ShippingAddress, 'id'>): Promise<ShippingAddress> {
    try {
      const createdAddress = await this.prisma.shippingAddress.create({
        data: {
          firstName: addressData.firstName,
          lastName: addressData.lastName,
          addressLine1: addressData.addressLine1,
          addressLine2: addressData.addressLine2,
          city: addressData.city,
          state: addressData.state,
          postalCode: addressData.postalCode,
          country: addressData.country,
          phone: addressData.phone,
        },
      });

      this.logger.info('Shipping address created successfully', { addressId: createdAddress.id });
      return this.mapToShippingAddressEntity(createdAddress);
    } catch (error) {
      this.logger.error('Error creating shipping address', { error, addressData });
      throw error;
    }
  }

  async updateShippingAddress(id: string, addressData: Partial<Omit<ShippingAddress, 'id'>>): Promise<ShippingAddress> {
    try {
      const updatedAddress = await this.prisma.shippingAddress.update({
        where: { id },
        data: addressData,
      });

      this.logger.info('Shipping address updated successfully', { addressId: id });
      return this.mapToShippingAddressEntity(updatedAddress);
    } catch (error) {
      this.logger.error('Error updating shipping address', { error, addressId: id, addressData });
      throw error;
    }
  }

  async getShippingAddress(id: string): Promise<ShippingAddress | null> {
    try {
      const address = await this.prisma.shippingAddress.findUnique({
        where: { id },
      });

      if (!address) {
        this.logger.debug('Shipping address not found', { addressId: id });
        return null;
      }

      return this.mapToShippingAddressEntity(address);
    } catch (error) {
      this.logger.error('Error getting shipping address', { error, addressId: id });
      throw error;
    }
  }

  async getOrderStats(): Promise<OrderStats> {
    try {
      const [
        totalOrders,
        pendingOrders,
        processingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        totalRevenue,
        averageOrderValue,
      ] = await Promise.all([
        this.prisma.order.count(),
        this.prisma.order.count({ where: { status: 'pending' } }),
        this.prisma.order.count({ where: { status: 'processing' } }),
        this.prisma.order.count({ where: { status: 'shipped' } }),
        this.prisma.order.count({ where: { status: 'delivered' } }),
        this.prisma.order.count({ where: { status: 'cancelled' } }),
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
        }),
        this.prisma.order.aggregate({
          _avg: { totalAmount: true },
        }),
      ]);

      const stats: OrderStats = {
        totalOrders,
        pendingOrders,
        processingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        averageOrderValue: averageOrderValue._avg.totalAmount || 0,
      };

      this.logger.debug('Order stats calculated', { stats });
      return stats;
    } catch (error) {
      this.logger.error('Error calculating order stats', { error });
      throw error;
    }
  }

  async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
    try {
      const orders = await this.prisma.order.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          items: true,
          shippingAddress: true,
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug('Orders found by date range', { startDate, endDate, count: orders.length });
      return orders.map(order => this.mapToOrderEntity(order));
    } catch (error) {
      this.logger.error('Error finding orders by date range', { error, startDate, endDate });
      throw error;
    }
  }

  private mapToOrderEntity(prismaOrder: any): Order {
    return new Order({
      id: prismaOrder.id,
      orderNumber: prismaOrder.orderNumber,
      userId: prismaOrder.userId,
      status: prismaOrder.status,
      totalAmount: prismaOrder.totalAmount,
      currency: prismaOrder.currency,
      paymentMethod: prismaOrder.paymentMethod,
      shippingMethod: prismaOrder.shippingMethod,
      notes: prismaOrder.notes,
      items: prismaOrder.items?.map((item: any) => this.mapToOrderItemEntity(item)) || [],
      shippingAddress: prismaOrder.shippingAddress ? this.mapToShippingAddressEntity(prismaOrder.shippingAddress) : undefined,
      createdAt: prismaOrder.createdAt,
      updatedAt: prismaOrder.updatedAt,
    });
  }

  private mapToOrderItemEntity(prismaItem: any): OrderItem {
    return new OrderItem({
      id: prismaItem.id,
      orderId: prismaItem.orderId,
      productId: prismaItem.productId,
      quantity: prismaItem.quantity,
      unitPrice: prismaItem.unitPrice,
      totalPrice: prismaItem.totalPrice,
      variantId: prismaItem.variantId,
      createdAt: prismaItem.createdAt,
    });
  }

  private mapToShippingAddressEntity(prismaAddress: any): ShippingAddress {
    return new ShippingAddress({
      id: prismaAddress.id,
      firstName: prismaAddress.firstName,
      lastName: prismaAddress.lastName,
      addressLine1: prismaAddress.addressLine1,
      addressLine2: prismaAddress.addressLine2,
      city: prismaAddress.city,
      state: prismaAddress.state,
      postalCode: prismaAddress.postalCode,
      country: prismaAddress.country,
      phone: prismaAddress.phone,
    });
  }
}
