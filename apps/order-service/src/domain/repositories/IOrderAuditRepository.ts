/**
 * IOrderAuditRepository
 *
 * Persists immutable audit records for every status transition on an order,
 * covering BOTH the commercial status axis (OrderStatus) and the payment status
 * axis (PaymentStatus).
 *
 * Contract: recordStatusChange() MUST be called inside the same Prisma
 * transaction ($transaction) that performs the status UPDATE on the orders
 * table. The implementation (PrismaOrderAuditRepository) receives the
 * transactional PrismaClient via parameter injection so it participates in
 * the enclosing transaction.
 *
 * Example call site (use case, inside prisma.$transaction):
 *
 *   await prisma.$transaction(async (tx) => {
 *     await orderRepo.updateStatus(id, newStatus, currentUser, tx);
 *     await auditRepo.recordStatusChange({
 *       orderId: id,
 *       fromStatus: previousStatus,
 *       toStatus: newStatus,
 *       changedByUserId: currentUser?.userId,
 *       notes: 'Confirmed by warehouse staff',
 *     }, tx);
 *   });
 */
export interface IOrderAuditRepository {
  /**
   * Inserts a single audit row for a status transition.
   *
   * @param params.orderId          - The order that changed state.
   * @param params.fromStatus       - Previous status value (string code, e.g. "pending").
   *                                  Pass the enum value's string representation for both
   *                                  OrderStatus and PaymentStatus transitions.
   * @param params.toStatus         - New status value (string code).
   * @param params.changedByUserId  - Authenticated user who triggered the change.
   *                                  Omit / pass undefined for system-driven transitions
   *                                  (event consumers, scheduled jobs, payment webhooks).
   * @param params.notes            - Optional free-text reason or context for the transition.
   */
  recordStatusChange(params: RecordStatusChangeParams): Promise<void>;

  /**
   * Returns the full audit trail for an order, ordered by changedAt ascending.
   * Useful for rendering a timeline in the admin UI or for debugging.
   *
   * @param orderId - The order whose history to retrieve.
   */
  getHistory(orderId: string): Promise<OrderStatusHistoryEntry[]>;
}

export interface RecordStatusChangeParams {
  orderId: string;
  fromStatus: string;
  toStatus: string;
  changedByUserId?: string;
  notes?: string;
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  fromStatus: string;
  toStatus: string;
  changedByUserId: string | null;
  changedAt: Date;
  notes: string | null;
}
