import { Order, CreateOrderRequest, UpdateOrderRequest, OrderItem, ShippingAddress } from '../entities/Order';

export interface IOrderRepository {
  // Operaciones básicas de pedidos
  create(orderData: CreateOrderRequest): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findAll(filters?: OrderFilters): Promise<Order[]>;
  update(id: string, orderData: UpdateOrderRequest): Promise<Order>;
  delete(id: string): Promise<boolean>;
  
  // Operaciones específicas
  findByStatus(status: string): Promise<Order[]>;
  findByCustomerEmail(email: string): Promise<Order[]>;
  updateStatus(id: string, status: string): Promise<Order>;
  
  // Operaciones de items de pedido
  addOrderItem(orderId: string, item: Omit<OrderItem, 'id' | 'orderId' | 'createdAt'>): Promise<OrderItem>;
  removeOrderItem(orderId: string, itemId: string): Promise<boolean>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  
  // Operaciones de dirección de envío
  createShippingAddress(addressData: Omit<ShippingAddress, 'id'>): Promise<ShippingAddress>;
  updateShippingAddress(id: string, addressData: Partial<Omit<ShippingAddress, 'id'>>): Promise<ShippingAddress>;
  getShippingAddress(id: string): Promise<ShippingAddress | null>;
  
  // Estadísticas
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