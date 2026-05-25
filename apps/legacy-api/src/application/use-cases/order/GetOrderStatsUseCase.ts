import { IOrderRepository, OrderStats } from '@domain/repositories/IOrderRepository';

export class GetOrderStatsUseCase {
  constructor(private orderRepository: IOrderRepository) {}

  async execute(): Promise<OrderStats> {
    try {
      return await this.orderRepository.getOrderStats();
    } catch (error) {
      throw new Error(`Failed to get order stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 