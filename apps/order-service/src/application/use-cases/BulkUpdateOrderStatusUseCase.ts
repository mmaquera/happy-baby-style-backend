import type { ILogger } from '@hbs/logging';
import { LoggerFactory } from '@hbs/logging';
import { ValidationError } from '@hbs/shared-kernel';
import type { TokenPayload } from '@hbs/auth';
import { Order } from '../../domain/entities/Order';
import { UpdateOrderUseCase } from './UpdateOrderUseCase';

export const BULK_UPDATE_MAX_ORDERS = 100;

/**
 * Bulk-updates the status of multiple orders.
 *
 * Security properties:
 * - Array size is capped at BULK_UPDATE_MAX_ORDERS (100) to prevent DoS via oversized batches.
 * - Delegates each update to UpdateOrderUseCase (not repo.update directly) so that
 *   write-gate-first (ensureWritable), TOCTOU pre-fetch (findByIdUnrestricted), and
 *   state-machine validation (validateStatusTransition) are all enforced per item.
 * - Uses Promise.allSettled so a single denied/not-found order does NOT abort the whole batch.
 * - Returns ONLY the successfully updated orders; rejected entries are logged server-side
 *   (count + ids) but are NOT surfaced in the response. This preserves ambiguity-404:
 *   the caller cannot infer which specific order IDs were denied by a record rule.
 */
export class BulkUpdateOrderStatusUseCase {
  private readonly logger: ILogger;

  constructor(private readonly updateOrderUseCase: UpdateOrderUseCase) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger(
      'BulkUpdateOrderStatusUseCase',
    );
  }

  async execute(
    orderIds: string[],
    status: string,
    currentUser: TokenPayload | null,
  ): Promise<Order[]> {
    // Guard: cap array size before any processing to prevent unbounded work.
    if (orderIds.length > BULK_UPDATE_MAX_ORDERS) {
      throw new ValidationError(
        `Bulk update accepts at most ${BULK_UPDATE_MAX_ORDERS} orders per request`,
        'orders',
      );
    }

    // allSettled: every promise runs to completion regardless of individual failures.
    // Delegates to UpdateOrderUseCase per item so write-gate-first + state-machine
    // validation are enforced on each order, same as the single-order updateOrderStatus.
    const results = await Promise.allSettled(
      orderIds.map((id) =>
        this.updateOrderUseCase.execute(id, { status: status as any }, currentUser),
      ),
    );

    const succeeded: Order[] = [];
    const failedIds: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        succeeded.push(result.value);
      } else {
        // Collect for server-side logging only — do NOT expose to the caller.
        failedIds.push(orderIds[i]);
      }
    }

    if (failedIds.length > 0) {
      this.logger.error(
        'bulkUpdateOrderStatus: some orders could not be updated (access denied, not found, or invalid transition)',
        new Error('bulk_partial_failure'),
        {
          failedCount: failedIds.length,
          failedIds, // IDs are logged server-side only, never returned to GraphQL
          targetStatus: status,
        },
      );
    }

    this.logger.info('bulkUpdateOrderStatus completed', {
      total: orderIds.length,
      succeeded: succeeded.length,
      failed: failedIds.length,
      targetStatus: status,
    });

    return succeeded;
  }
}
