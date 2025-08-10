import { IOrderRepository } from '@domain/repositories/IOrderRepository';
import { UpdateOrderRequest, Order } from '@domain/entities/Order';

export class UpdateOrderUseCase {
  constructor(private orderRepository: IOrderRepository) {}

  async execute(id: string, orderData: UpdateOrderRequest): Promise<Order> {
    try {
      if (!id) {
        throw new Error('Order ID is required');
      }

      // Verificar que el pedido existe
      const existingOrder = await this.orderRepository.findById(id);
      if (!existingOrder) {
        throw new Error('Order not found');
      }

      // Validaciones específicas según el estado
      if (orderData.status) {
        this.validateStatusTransition(existingOrder.status, orderData.status);
      }

      return await this.orderRepository.update(id, orderData);
    } catch (error) {
      throw new Error(`Failed to update order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [], // Estado final
      cancelled: [] // Estado final
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }
} 