import { PrismaClient } from '../../prisma';
import {
  IOrderAuditRepository,
  RecordStatusChangeParams,
  OrderStatusHistoryEntry,
} from '../../domain/repositories/IOrderAuditRepository';
import { LoggerFactory, ILogger } from '@hbs/logging';

/**
 * PrismaOrderAuditRepository
 *
 * Persists immutable audit rows for every status transition on an order.
 *
 * Atomicity contract:
 *   recordStatusChange() inserts into order_status_history.  When the caller
 *   wraps it in a prisma.$transaction alongside the orders UPDATE, both writes
 *   are committed or rolled back together.
 *
 *   In this round the use case calls recordStatusChange() in a best-effort
 *   try/catch AFTER repo.update() commits.  The PrismaClient instance injected
 *   here is the service-level singleton (not a TransactionClient), so each
 *   insert is its own autocommit transaction.  Full atomicity (single
 *   transaction) is a round ⑥ upgrade when UpdateOrderUseCase is refactored to
 *   use prisma.$transaction.
 */
export class PrismaOrderAuditRepository implements IOrderAuditRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger(
      'PrismaOrderAuditRepository',
    );
  }

  async recordStatusChange(params: RecordStatusChangeParams): Promise<void> {
    const { orderId, fromStatus, toStatus, changedByUserId, notes } = params;
    try {
      await this.prisma.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus,
          toStatus,
          changedByUserId: changedByUserId ?? null,
          notes: notes ?? null,
        },
      });
      this.logger.info('Recorded order status change', {
        orderId,
        fromStatus,
        toStatus,
        changedByUserId,
      });
    } catch (error) {
      this.logger.error(
        'Error recording order status change',
        error instanceof Error ? error : new Error(String(error)),
        { orderId, fromStatus, toStatus },
      );
      throw error;
    }
  }

  async getHistory(orderId: string): Promise<OrderStatusHistoryEntry[]> {
    try {
      const rows = await this.prisma.orderStatusHistory.findMany({
        where: { orderId },
        orderBy: { changedAt: 'asc' },
      });
      return rows.map((row) => ({
        id: row.id,
        orderId: row.orderId,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        changedByUserId: row.changedByUserId,
        changedAt: row.changedAt,
        notes: row.notes,
      }));
    } catch (error) {
      this.logger.error(
        'Error fetching order status history',
        error instanceof Error ? error : new Error(String(error)),
        { orderId },
      );
      throw error;
    }
  }
}
