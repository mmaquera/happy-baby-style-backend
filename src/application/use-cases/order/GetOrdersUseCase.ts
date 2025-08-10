import { IOrderRepository, OrderFilters } from '@domain/repositories/IOrderRepository';
import { Order } from '@domain/entities/Order';

export interface GetOrdersRequest {
  filters?: {
    userId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    orderNumber?: string;
  };
  pagination?: {
    limit?: number;
    offset?: number;
  };
}

export interface GetOrdersResponse {
  orders: Order[];
  total: number;
  hasMore: boolean;
}

export class GetOrdersUseCase {
  constructor(private orderRepository: IOrderRepository) {}

  async execute(request: GetOrdersRequest = {}): Promise<GetOrdersResponse> {
    try {
      const pagination = request.pagination || {};
      const limit = pagination.limit || 50;
      const offset = pagination.offset || 0;
      
      const filters: OrderFilters = {
        userId: request.filters?.userId,
        status: request.filters?.status,
        startDate: request.filters?.startDate,
        endDate: request.filters?.endDate,
        orderNumber: request.filters?.orderNumber,
        limit,
        offset
      };

      const orders = await this.orderRepository.findAll(filters);
      
      // Note: This is a simplified implementation. 
      // For production, you'd want to get the actual total count from the database
      const hasMore = orders.length === limit;
      const total = offset + orders.length + (hasMore ? 1 : 0);

      return {
        orders,
        total,
        hasMore
      };
    } catch (error) {
      throw new Error(`Failed to get orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 