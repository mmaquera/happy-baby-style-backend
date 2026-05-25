import { Order } from '../../../domain/entities/Order';

export interface UserOrderHistoryRequest {
  userId: string;
  limit?: number;
  offset?: number;
  status?: string;
  sortBy?: 'created_at' | 'total_amount' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface UserOrderHistoryResponse {
  orders: Order[];
  total: number;
  hasMore: boolean;
  stats: {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrderDate?: Date;
  };
}

export interface IUserOrderRepository {
  getUserOrders(params: UserOrderHistoryRequest): Promise<{orders: Order[], total: number}>;
  getUserOrderStats(userId: string): Promise<{
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrderDate?: Date;
  }>;
}

export class GetUserOrderHistoryUseCase {
  constructor(private orderRepository: IUserOrderRepository) {}

  async execute(params: UserOrderHistoryRequest): Promise<UserOrderHistoryResponse> {
    // Validate user ID
    if (!params.userId) {
      throw new Error('User ID is required');
    }

    // Set defaults
    const limit = params.limit || 20;
    const offset = params.offset || 0;

    // Validate pagination parameters
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    if (offset < 0) {
      throw new Error('Offset must be non-negative');
    }

    // Get user orders
    const { orders, total } = await this.orderRepository.getUserOrders({
      ...params,
      limit,
      offset
    });

    // Get user order statistics
    const stats = await this.orderRepository.getUserOrderStats(params.userId);

    // Calculate if there are more orders
    const hasMore = offset + orders.length < total;

    return {
      orders,
      total,
      hasMore,
      stats
    };
  }

  async getRecentOrders(userId: string, limit = 5): Promise<Order[]> {
    // Validate user ID
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Validate limit
    if (limit < 1 || limit > 50) {
      throw new Error('Limit must be between 1 and 50');
    }

    const { orders } = await this.orderRepository.getUserOrders({
      userId,
      limit,
      offset: 0,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });

    return orders;
  }

  async getOrdersByStatus(userId: string, status: string): Promise<Order[]> {
    // Validate inputs
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!status) {
      throw new Error('Order status is required');
    }

    const { orders } = await this.orderRepository.getUserOrders({
      userId,
      status,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });

    return orders;
  }

  async getUserOrderSummary(userId: string): Promise<{
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrderDate?: Date;
    ordersByStatus: Record<string, number>;
  }> {
    // Validate user ID
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get basic stats
    const stats = await this.orderRepository.getUserOrderStats(userId);

    // Get all orders to calculate status breakdown
    const { orders } = await this.orderRepository.getUserOrders({
      userId,
      limit: 1000, // High limit to get all orders for stats
      offset: 0
    });

    // Calculate orders by status
    const ordersByStatus: Record<string, number> = {};
    orders.forEach(order => {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
    });

    return {
      ...stats,
      ordersByStatus
    };
  }
}