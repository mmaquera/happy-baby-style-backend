import type { TokenPayload } from '@hbs/auth';
import { IOrderRepository, OrderFilters } from '../../domain/repositories/IOrderRepository';
import { Order } from '../../domain/entities/Order';

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
  /** Authenticated caller — forwarded to the repo for record-rule filtering. */
  currentUser?: TokenPayload | null;
}

export interface GetOrdersResponse {
  orders: Order[];
  total: number;
  hasMore: boolean;
}

export class GetOrdersUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(request: GetOrdersRequest = {}): Promise<GetOrdersResponse> {
    const limit = request.pagination?.limit || 50;
    const offset = request.pagination?.offset || 0;

    const filters: OrderFilters = {
      userId: request.filters?.userId,
      status: request.filters?.status,
      startDate: request.filters?.startDate,
      endDate: request.filters?.endDate,
      orderNumber: request.filters?.orderNumber,
      limit,
      offset,
    };

    const orders = await this.orderRepository.findAll(filters, request.currentUser ?? null);
    const hasMore = orders.length === limit;

    return {
      orders,
      total: offset + orders.length + (hasMore ? 1 : 0),
      hasMore,
    };
  }
}
