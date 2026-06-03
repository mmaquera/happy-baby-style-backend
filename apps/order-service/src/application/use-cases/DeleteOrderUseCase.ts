import type { TokenPayload } from '@hbs/auth';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { ValidationError } from '@hbs/shared-kernel';
import { assertOwnerOrOrderManagement } from './guards/orderAuthGuards';

export interface DeleteOrderResult {
  success: boolean;
  message: string;
}

/**
 * DeleteOrderUseCase
 *
 * Deletes an order, enforcing ownership / management access BEFORE the repository
 * call so that:
 *
 *   1. Unauthenticated callers are rejected immediately (UNAUTHENTICATED).
 *   2. Non-owner, non-management callers receive FORBIDDEN.
 *   3. The repository's delete() then applies the unlink-mode record rule as
 *      defence-in-depth and returns an ambiguous NotFoundError when the order
 *      does not exist or the rule denies access.
 *
 * Guard order:
 *   assertOwnerOrOrderManagement → repo.delete (ensureWritable unlink + cascade)
 *
 * Note: write-gate-first (ensureWritable) is applied INSIDE PrismaOrderRepository.delete
 * to maintain the ambiguous-404 invariant.  The guard here is a higher-level ownership
 * check that happens before we know whether the order exists — that is intentional to
 * reject non-owners before the DB round-trip.
 */
export class DeleteOrderUseCase {
  private readonly logger: ILogger;

  constructor(private readonly orderRepository: IOrderRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteOrderUseCase');
  }

  async execute(
    id: string,
    currentUser: TokenPayload | null,
    /** Target userId — needed by assertOwnerOrOrderManagement.
     *  When not provided up-front the use case fetches it via findByIdUnrestricted.
     *  Pass it explicitly when the resolver already has the owner from a prior prefetch
     *  to save the round-trip.
     */
    targetUserId?: string,
  ): Promise<DeleteOrderResult> {
    if (!id) throw new ValidationError('Order ID is required', 'id');

    // Resolve the owner for the ownership guard.  We use findByIdUnrestricted so that
    // read-mode record rules do not interfere with the management path.
    //
    // If the order does not exist the repo returns null and we still call
    // assertOwnerOrOrderManagement — that throws UNAUTHENTICATED/FORBIDDEN as
    // appropriate.  The subsequent repo.delete() will then throw the ambiguous
    // NotFoundError, so existence is never confirmed to a non-owner.
    let ownerUserId: string;
    if (targetUserId) {
      ownerUserId = targetUserId;
    } else {
      const order = await this.orderRepository.findByIdUnrestricted(id);
      // Use a sentinel that will never match any real userId so assertOwnerOrOrderManagement
      // falls through to the management check — management users still succeed; non-owners
      // are rejected before the ambiguous-404 from repo.delete.
      ownerUserId = order?.userId ?? '__not_found__';
    }

    // Throws UNAUTHENTICATED or FORBIDDEN as appropriate.
    assertOwnerOrOrderManagement(currentUser, ownerUserId);

    // Repo enforces the unlink-mode record rule internally (defence-in-depth).
    // Returns ambiguous NotFoundError when the order does not exist or is denied.
    await this.orderRepository.delete(id, currentUser);

    // M-2 anti-enumeration: always return the same message regardless of whether
    // the record existed. The caller cannot infer existence from the response.
    this.logger.info('Order deleted', { orderId: id, userId: currentUser?.userId });

    return { success: true, message: 'Operation completed' };
  }
}
