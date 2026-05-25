import { PrismaClient } from '@prisma/client';
import { IOrderRepository, OrderFilters, OrderStats } from '@domain/repositories/IOrderRepository';
import { Order, CreateOrderRequest, UpdateOrderRequest, OrderItem, ShippingAddress, OrderStatus } from '@domain/entities/Order';
import { ILogger } from '@domain/interfaces/ILogger';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';

export class PrismaOrderRepository implements IOrderRepository {
  private readonly logger: ILogger;

  constructor(private prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaOrderRepository');
  }

  async create(orderData: CreateOrderRequest): Promise<Order> {
    try {
      // Crear la dirección de envío primero
      const shippingAddress = await this.prisma.userAddress.create({
        data: {
          userId: 'temp-user-id', // Esto debería venir del contexto de autenticación
          type: 'shipping',
          firstName: orderData.shippingAddress.street.split(' ')[0] || 'Customer',
          lastName: orderData.shippingAddress.street.split(' ').slice(1).join(' ') || 'Name',
          address1: orderData.shippingAddress.street,
          city: orderData.shippingAddress.city,
          state: orderData.shippingAddress.state,
          postalCode: orderData.shippingAddress.zipCode,
          country: orderData.shippingAddress.country || 'PE',
        },
      });

      // Calcular el total del pedido
      const total = orderData.items.reduce((sum, item) => {
        // Aquí deberías obtener el precio del producto desde la base de datos
        const itemPrice = 0; // Placeholder - obtener precio real del producto
        return sum + (itemPrice * item.quantity);
      }, 0);

      // Crear el pedido
      const createdOrder = await this.prisma.order.create({
        data: {
          userId: 'temp-user-id', // Esto debería venir del contexto de autenticación
          orderNumber: this.generateOrderNumber(),
          status: 'pending' as OrderStatus,
          subtotal: total,
          taxAmount: 0,
          shippingAmount: 0,
          discountAmount: 0,
          totalAmount: total,
          currency: 'PEN',
          shippingAddressId: shippingAddress.id,
          notes: '',
        },
        include: {
          items: true,
          shippingAddress: true,
          user: true,
        },
      });

      // Crear los items del pedido
      const orderItems = await Promise.all(
        orderData.items.map(async (item) => {
          return this.prisma.orderItem.create({
            data: {
              orderId: createdOrder.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: 0, // Placeholder - obtener precio real del producto
              totalPrice: 0, // Placeholder - calcular precio total real
            },
          });
        })
      );

      this.logger.info('Order created successfully', { orderId: createdOrder.id });
      
      // Mapear a la entidad de dominio
      return this.mapToOrderEntity(createdOrder, orderItems, shippingAddress);
    } catch (error) {
      this.logger.error('Error creating order', error instanceof Error ? error : new Error(String(error)), {
        orderData
      });
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

      return this.mapToOrderEntity(order, order.items, order.shippingAddress);
    } catch (error) {
      this.logger.error('Error finding order by id', error instanceof Error ? error : new Error(String(error)), {
        orderId: id
      });
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
      return orders.map(order => 
        this.mapToOrderEntity(order, order.items, order.shippingAddress)
      );
    } catch (error) {
      this.logger.error('Error finding orders', error instanceof Error ? error : new Error(String(error)), {
        filters
      });
      throw error;
    }
  }

  async update(id: string, orderData: UpdateOrderRequest): Promise<Order> {
    try {
      const updateData: any = {};

      if (orderData.status) {
        updateData.status = orderData.status;
      }

      if (orderData.customerEmail) {
        updateData.user = {
          update: {
            email: orderData.customerEmail,
          },
        };
      }

      if (orderData.deliveredAt) {
        updateData.deliveredAt = orderData.deliveredAt;
      }

      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          items: true,
          shippingAddress: true,
          user: true,
        },
      });

      this.logger.info('Order updated successfully', { orderId: id });
      return this.mapToOrderEntity(updatedOrder, updatedOrder.items, updatedOrder.shippingAddress);
    } catch (error) {
      this.logger.error('Error updating order', error instanceof Error ? error : new Error(String(error)), {
        orderId: id,
        orderData
      });
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
      this.logger.error('Error deleting order', error instanceof Error ? error : new Error(String(error)), {
        orderId: id
      });
      throw error;
    }
  }

  async findByStatus(status: string): Promise<Order[]> {
    try {
      const orders = await this.prisma.order.findMany({
        where: { status: status as OrderStatus },
        include: {
          items: true,
          shippingAddress: true,
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug('Orders found by status', { status, count: orders.length });
      return orders.map(order => 
        this.mapToOrderEntity(order, order.items, order.shippingAddress)
      );
    } catch (error) {
      this.logger.error('Error finding orders by status', error instanceof Error ? error : new Error(String(error)), {
        status
      });
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
      return orders.map(order => 
        this.mapToOrderEntity(order, order.items, order.shippingAddress)
      );
    } catch (error) {
      this.logger.error('Error finding orders by customer email', error instanceof Error ? error : new Error(String(error)), {
        email
      });
      throw error;
    }
  }

  async updateStatus(id: string, status: string): Promise<Order> {
    try {
      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: { status: status as OrderStatus },
        include: {
          items: true,
          shippingAddress: true,
          user: true,
        },
      });

      this.logger.info('Order status updated successfully', { orderId: id, status });
      return this.mapToOrderEntity(updatedOrder, updatedOrder.items, updatedOrder.shippingAddress);
    } catch (error) {
      this.logger.error('Error updating order status', error instanceof Error ? error : new Error(String(error)), {
        orderId: id,
        status
      });
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
          unitPrice: item.price,
          totalPrice: item.price * item.quantity,
        },
      });

      this.logger.info('Order item added successfully', { orderId, itemId: createdItem.id });
      return this.mapToOrderItemEntity(createdItem);
    } catch (error) {
      this.logger.error('Error adding order item', error instanceof Error ? error : new Error(String(error)), {
        orderId,
        item
      });
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
      this.logger.error('Error removing order item', error instanceof Error ? error : new Error(String(error)), {
        orderId,
        itemId
      });
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
      this.logger.error('Error getting order items', error instanceof Error ? error : new Error(String(error)), {
        orderId
      });
      throw error;
    }
  }

  async createShippingAddress(addressData: Omit<ShippingAddress, 'id'>): Promise<ShippingAddress> {
    try {
      const createdAddress = await this.prisma.userAddress.create({
        data: {
          userId: 'temp-user-id', // Esto debería venir del contexto de autenticación
          type: 'shipping',
          firstName: addressData.street.split(' ')[0] || 'Customer',
          lastName: addressData.street.split(' ').slice(1).join(' ') || 'Name',
          address1: addressData.street,
          city: addressData.city,
          state: addressData.state,
          postalCode: addressData.zipCode,
          country: addressData.country,
        },
      });

      this.logger.info('Shipping address created successfully', { addressId: createdAddress.id });
      return this.mapToShippingAddressEntity(createdAddress);
    } catch (error) {
      this.logger.error('Error creating shipping address', error instanceof Error ? error : new Error(String(error)), {
        addressData
      });
      throw error;
    }
  }

  async updateShippingAddress(id: string, addressData: Partial<Omit<ShippingAddress, 'id'>>): Promise<ShippingAddress> {
    try {
      const updateData: any = {};

      if (addressData.street) {
        updateData.address1 = addressData.street;
        updateData.firstName = addressData.street.split(' ')[0] || 'Customer';
        updateData.lastName = addressData.street.split(' ').slice(1).join(' ') || 'Name';
      }

      if (addressData.city) updateData.city = addressData.city;
      if (addressData.state) updateData.state = addressData.state;
      if (addressData.zipCode) updateData.postalCode = addressData.zipCode;
      if (addressData.country) updateData.country = addressData.country;

      const updatedAddress = await this.prisma.userAddress.update({
        where: { id },
        data: updateData,
      });

      this.logger.info('Shipping address updated successfully', { addressId: id });
      return this.mapToShippingAddressEntity(updatedAddress);
    } catch (error) {
      this.logger.error('Error updating shipping address', error instanceof Error ? error : new Error(String(error)), {
        addressId: id,
        addressData
      });
      throw error;
    }
  }

  async getShippingAddress(id: string): Promise<ShippingAddress | null> {
    try {
      const address = await this.prisma.userAddress.findUnique({
        where: { id },
      });

      if (!address) {
              this.logger.debug('Shipping address not found', { addressId: id });
      return null;
    }

    return this.mapToShippingAddressEntity(address);
  } catch (error) {
    this.logger.error('Error getting shipping address', error instanceof Error ? error : new Error(String(error)), {
      addressId: id
    });
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
        totalRevenue: Number(totalRevenue._sum.totalAmount) || 0,
        averageOrderValue: Number(averageOrderValue._avg.totalAmount) || 0,
      };

      this.logger.debug('Order stats calculated', { stats });
      return stats;
    } catch (error) {
      this.logger.error('Error calculating order stats', error instanceof Error ? error : new Error(String(error)));
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
      return orders.map(order => 
        this.mapToOrderEntity(order, order.items, order.shippingAddress)
      );
    } catch (error) {
      this.logger.error('Error finding orders by date range', error instanceof Error ? error : new Error(String(error)), {
        startDate,
        endDate
      });
      throw error;
    }
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `ORD-${timestamp}-${random}`.toUpperCase();
  }

  private mapToOrderEntity(prismaOrder: any, items: any[], shippingAddress: any): Order {
    return {
      id: prismaOrder.id,
      customerEmail: prismaOrder.user?.email || '',
      customerName: `${prismaOrder.user?.firstName || ''} ${prismaOrder.user?.lastName || ''}`.trim(),
      customerPhone: prismaOrder.user?.phone || undefined,
      status: prismaOrder.status as OrderStatus,
      total: Number(prismaOrder.totalAmount),
      shippingAddressId: prismaOrder.shippingAddressId || '',
      createdAt: prismaOrder.createdAt,
      updatedAt: prismaOrder.updatedAt,
      deliveredAt: prismaOrder.deliveredAt || undefined,
      items: items.map(item => this.mapToOrderItemEntity(item)),
      shippingAddress: shippingAddress ? this.mapToShippingAddressEntity(shippingAddress) : undefined,
    };
  }

  private mapToOrderItemEntity(prismaItem: any): OrderItem {
    return {
      id: prismaItem.id,
      orderId: prismaItem.orderId,
      productId: prismaItem.productId,
      quantity: prismaItem.quantity,
      price: Number(prismaItem.unitPrice),
      size: 'recien_nacido' as any, // Placeholder - obtener del producto
      color: 'blanco' as any, // Placeholder - obtener del producto
      createdAt: prismaItem.createdAt,
    };
  }

  private mapToShippingAddressEntity(prismaAddress: any): ShippingAddress {
    return {
      id: prismaAddress.id,
      street: prismaAddress.address1,
      city: prismaAddress.city,
      state: prismaAddress.state,
      zipCode: prismaAddress.postalCode,
      country: prismaAddress.country,
    };
  }
}
