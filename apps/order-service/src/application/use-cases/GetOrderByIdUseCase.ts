import type { TokenPayload } from '@hbs/auth';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { Order } from '../../domain/entities/Order';

export class GetOrderByIdUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(id: string, currentUser: TokenPayload | null = null): Promise<Order | null> {
    if (!id) throw new Error('Order ID is required');
    return this.orderRepository.findById(id, currentUser);
  }
}
