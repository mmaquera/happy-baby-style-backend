import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { UpdateOrderRequest, Order } from '../../domain/entities/Order';

export class UpdateOrderUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(id: string, orderData: UpdateOrderRequest): Promise<Order> {
    if (!id) throw new Error('Order ID is required');

    // Use findByIdUnrestricted for the pre-fetch: update operations are guarded by
    // requirePermission(UPDATE_ORDER) at the resolver layer, so record-rule read
    // filters must NOT apply here (passing null would trigger DENY_WHERE for any
    // active Order/read rule and break all updates even for admin/staff).
    const existing = await this.orderRepository.findByIdUnrestricted(id);
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
      cancelled: [],
    };

    if (!(valid[current] || []).includes(next)) {
      throw new Error(`Invalid status transition from ${current} to ${next}`);
    }
  }
}
