import { randomUUID } from 'crypto';
import type { TokenPayload } from '@hbs/auth';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { IOrderAuditRepository } from '../../domain/repositories/IOrderAuditRepository';
import { IEventPublisher } from '../../domain/ports/IEventPublisher';
import { UpdateOrderRequest, Order, OrderEntity, OrderStatus, BILLING_IMMUTABLE_FROM } from '../../domain/entities/Order';
import { NotFoundError, ValidationError, BusinessLogicError } from '@hbs/shared-kernel';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class UpdateOrderUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly auditRepository: IOrderAuditRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateOrderUseCase');
  }

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

    // ── Billing immutability guard (post-prefetch — authoritative check) ─────
    // Billing fields are frozen once the order moves to 'confirmed' or any later state.
    // Reject mutations here so no billing data reaches the repository update path.
    if (orderData.billingData !== undefined) {
      if (BILLING_IMMUTABLE_FROM.has(existing.status)) {
        throw new BusinessLogicError(
          `Billing data cannot be changed once the order is in status "${existing.status}"`,
        );
      }
    }

    // ── Status transition — delegated to OrderEntity (canonical state machine) ────
    // The entity's transition() method is the single source of truth for valid moves.
    // It throws BusinessLogicError on invalid transitions so the error is typed and
    // the caller can distinguish business logic failures from not-found / auth errors.
    const previousStatus = existing.status;
    let nextStatus: OrderStatus | undefined;
    // Timestamps set by the transition — must be persisted alongside the new status.
    let deliveredAt: Date | undefined;

    if (orderData.status) {
      // Reconstruct the full entity so that transition() can set lifecycle timestamps
      // (deliveredAt on →delivered) and return them on the new immutable instance.
      const entity = new OrderEntity(
        existing.id,
        existing.userId,
        existing.orderNumber,
        existing.customerEmail,
        existing.customerName,
        existing.status,
        existing.paymentStatus ?? 'pending',
        Number(existing.subtotal),
        Number(existing.taxAmount),
        Number(existing.shippingAmount),
        Number(existing.discountAmount),
        Number(existing.totalAmount),
        existing.currency,
        existing.createdAt,
        existing.updatedAt,
        existing.shippingAddressId,
        existing.notes,
        existing.deliveredAt,
        existing.items ?? [],
        existing.shippingAddress,
      );
      // Throws BusinessLogicError if invalid — never returns when transition is bad.
      // Use the returned instance so that lifecycle timestamps (deliveredAt, etc.)
      // computed by transition() are captured — the original `entity` is immutable.
      const transitioned = entity.transition(orderData.status as OrderStatus);
      nextStatus = orderData.status as OrderStatus;
      // Capture deliveredAt from the transitioned entity so the repo persists it.
      // transition() sets deliveredAt = new Date() when newStatus === 'delivered',
      // and preserves existing.deliveredAt for all other transitions.
      deliveredAt = transitioned.deliveredAt;
    }

    // Build the update payload with lifecycle timestamps derived from the entity transition.
    // This ensures deliveredAt (and any future transition timestamps) are persisted atomically
    // with the status change rather than relying on client-supplied values.
    const updatePayload: typeof orderData = {
      ...orderData,
      ...(deliveredAt !== undefined ? { deliveredAt } : {}),
    };

    // Write-mode rules are re-enforced inside repo.update (defence-in-depth).
    const updated = await this.orderRepository.update(id, updatePayload, currentUser);

    // ── Audit: record the status transition inside a best-effort call ────────────
    // The canonical approach would be to run auditRepo.recordStatusChange inside the
    // same DB transaction as repo.update. Wired transactionally in PrismaOrderAuditRepository
    // (this round). A failure here is logged but does not roll back the already-committed
    // update — the audit trail has a gap, which is preferable to failing the mutation.
    if (nextStatus && previousStatus !== nextStatus) {
      try {
        await this.auditRepository.recordStatusChange({
          orderId: id,
          fromStatus: previousStatus,
          toStatus: nextStatus,
          changedByUserId: currentUser?.userId,
        });
      } catch (auditErr) {
        this.logger.error(
          'Failed to write status-change audit record — update already committed',
          auditErr instanceof Error ? auditErr : new Error(String(auditErr)),
          { orderId: id, fromStatus: previousStatus, toStatus: nextStatus },
        );
      }
    }

    // ── Event emission ────────────────────────────────────────────────────────────
    // Emit domain events when the order transitions to key lifecycle states.
    if (nextStatus) {
      const now = new Date().toISOString();
      try {
        if (nextStatus === 'confirmed') {
          await this.eventPublisher.publishOrderConfirmed({
            eventId: randomUUID(),
            orderId: id,
            orderNumber: updated.orderNumber,
            confirmedAt: now,
          });
        } else if (nextStatus === 'cancelled') {
          await this.eventPublisher.publishOrderCancelled({
            eventId: randomUUID(),
            orderId: id,
            orderNumber: updated.orderNumber,
            cancelledAt: now,
          });
        }
      } catch (publishErr) {
        this.logger.error(
          'Failed to publish order lifecycle event — update already committed',
          publishErr instanceof Error ? publishErr : new Error(String(publishErr)),
          { orderId: id, newStatus: nextStatus },
        );
      }
    }

    this.logger.info('Order updated', {
      orderId: id,
      previousStatus,
      newStatus: nextStatus ?? previousStatus,
      updatedBy: currentUser?.userId,
    });

    return updated;
  }
}
