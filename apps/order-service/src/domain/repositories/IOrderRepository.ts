import {
  Order,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderItem,
  ShippingAddress,
} from '../entities/Order';

export interface IOrderRepository {
  create(orderData: CreateOrderRequest, total: number, userId?: string): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findAll(filters?: OrderFilters): Promise<Order[]>;
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
}
