import { IOrderRepository, OrderStats } from '../../domain/repositories/IOrderRepository';

export class GetOrderStatsUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(): Promise<OrderStats> {
    return this.orderRepository.getOrderStats();
  }
}
