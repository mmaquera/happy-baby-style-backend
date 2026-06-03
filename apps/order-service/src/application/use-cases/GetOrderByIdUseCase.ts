import type { TokenPayload } from '@hbs/auth';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { Order } from '../../domain/entities/Order';
import { ValidationError } from '@hbs/shared-kernel';

export class GetOrderByIdUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(id: string, currentUser: TokenPayload | null = null): Promise<Order | null> {
    if (!id) throw new ValidationError('Order ID is required', 'id');
    return this.orderRepository.findById(id, currentUser);
  }
}
