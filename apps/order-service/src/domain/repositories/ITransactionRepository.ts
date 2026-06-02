import type { TokenPayload } from '@hbs/auth';

export interface TransactionData {
  id: string;
  orderId: string;
  userId: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  gateway: string | null;
  gatewayTransactionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransactionRepository {
  /**
   * Find all transactions for a given userId.
   * Returns transactions owned by the user; when called with management credentials
   * the same method is used — the caller is responsible for authorization.
   */
  findByUserId(userId: string): Promise<TransactionData[]>;

  /**
   * Find a single transaction by id.
   * Returns null when not found.
   * Does NOT enforce ownership — callers must apply owner-or-management guard.
   */
  findById(id: string): Promise<TransactionData | null>;

  /**
   * Resolve the userId owner of a transaction by loading its parent Order.
   * Returns null when the transaction does not exist.
   * Used by the use case to apply owner-or-management check before exposing data.
   */
  resolveOwnerUserId(transactionId: string): Promise<string | null>;
}
