import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { UpdateOrderRequest, Order } from '../../domain/entities/Order';

export class UpdateOrderUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(id: string, orderData: UpdateOrderRequest): Promise<Order> {
    if (!id) throw new Error('Order ID is required');

    const existing = await this.orderRepository.findById(id);
    if (!existing) throw new Error('Order not found');

    if (orderData.status) {
      this.validateStatusTransition(existing.status, orderData.status);
    }

    return this.orderRepository.update(id, orderData);
  }

  private validateStatusTransition(current: string, next: string): void {
    const valid: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: []
    };

    if (!(valid[current] || []).includes(next)) {
      throw new Error(`Invalid status transition from ${current} to ${next}`);
    }
  }
}
