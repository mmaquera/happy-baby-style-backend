import { IOrderRepository } from '@domain/repositories/IOrderRepository';
import { Order } from '@domain/entities/Order';

export class GetOrderByIdUseCase {
  constructor(private orderRepository: IOrderRepository) {}

  async execute(id: string): Promise<Order | null> {
    try {
      if (!id) {
        throw new Error('Order ID is required');
      }

      return await this.orderRepository.findById(id);
    } catch (error) {
      throw new Error(`Failed to get order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 