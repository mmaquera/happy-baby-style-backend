import type { TokenPayload } from '@hbs/auth';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { UpdateOrderRequest, Order } from '../../domain/entities/Order';
import { NotFoundError, ValidationError, BusinessLogicError } from '@hbs/shared-kernel';

export class UpdateOrderUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  /**
   * @param id          - The order ID to update.
   * @param orderData   - Fields to update on the order.
   * @param currentUser - Authenticated user from the request context. Forwarded to
   *   repo.update so write-mode record rules are enforced via assertWriteAccess inside
   *   the repository. Pass null only for internal callers without a user context
   *   (event consumers, background jobs).
   */
  async execute(
    id: string,
    orderData: UpdateOrderRequest,
    currentUser: TokenPayload | null,
  ): Promise<Order> {
    if (!id) throw new ValidationError('Order ID is required', 'id');

    // Write-gate-first: apply the write-mode record rule BEFORE any prefetch or
    // business logic. This ensures that an unauthorized caller (wrong user, denied
    // by a record rule) receives a generic NotFoundError (ambiguous 404) instead of
    // a business-logic error (e.g. "invalid status transition") that would leak
    // whether the order exists and in what state it is.
    //
    // Defence-in-depth: repo.update runs its own assertWriteAccess internally as well.
    // The double probe is intentional — it prevents information leaks at the use-case
    // level independently of the repository implementation.
    await this.orderRepository.ensureWritable(id, 'write', currentUser);

    // Pre-fetch uses findByIdUnrestricted: after the write-gate has passed, the
    // prefetch must NOT apply read-mode record rules. A read rule may hide the order
    // from a management user (e.g. "customers only see their own orders") even though
    // that user holds UPDATE_ORDER permission. Read and write rule sets are independent.
    const existing = await this.orderRepository.findByIdUnrestricted(id);
    // Narrow TOCTOU race: order was deleted between ensureWritable and this fetch.
    // Typed domain error so mapDomainError maps it to 404 (not 500).
    if (!existing) throw new NotFoundError('Order', id);

    if (orderData.status) {
      this.validateStatusTransition(existing.status, orderData.status);
    }

    // Write-mode rules are re-enforced inside repo.update (defence-in-depth).
    return this.orderRepository.update(id, orderData, currentUser);
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
      throw new BusinessLogicError(`Invalid status transition from ${current} to ${next}`);
    }
  }
}
