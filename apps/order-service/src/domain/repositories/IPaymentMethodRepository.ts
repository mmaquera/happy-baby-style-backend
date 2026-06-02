import type { TokenPayload } from '@hbs/auth';

export interface PaymentMethodData {
  id: string;
  orderId: string;
  type: string;
  amount: number;
  status: string;
  transactionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentMethodInput {
  orderId: string;
  type: string;
  amount: number;
  status?: string;
  transactionId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdatePaymentMethodInput {
  type?: string;
  amount?: number;
  status?: string;
  transactionId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface IPaymentMethodRepository {
  /**
   * Create a PaymentMethod for the given orderId.
   * The caller MUST have already verified write-access to the parent Order
   * before calling this method.
   */
  create(input: CreatePaymentMethodInput): Promise<PaymentMethodData>;

  /**
   * Find a PaymentMethod by id. Returns null when not found.
   */
  findById(id: string): Promise<PaymentMethodData | null>;

  /**
   * Update a PaymentMethod by id. Returns the updated record.
   * Throws NotFoundError when the id does not exist.
   * The caller MUST verify write-access to the parent Order before calling.
   */
  update(id: string, input: UpdatePaymentMethodInput): Promise<PaymentMethodData>;

  /**
   * Delete a PaymentMethod by id.
   * Throws NotFoundError when the id does not exist.
   * The caller MUST verify unlink-access to the parent Order before calling.
   */
  delete(id: string): Promise<boolean>;

  /**
   * Find all payment methods linked to orders of a given userId.
   * Returns raw data; callers must apply owner-or-management guard before invoking.
   */
  findByUserId(userId: string): Promise<PaymentMethodData[]>;

  /**
   * Resolve the userId owner of a payment method via its parent Order.
   * Returns null when the payment method does not exist.
   * Used by read use cases to apply owner-or-management check.
   */
  resolveOwnerUserId(paymentMethodId: string): Promise<string | null>;

  /**
   * Verify that the parent Order of a PaymentMethod is accessible for the
   * given user and mode. Throws NotFoundError (ambiguous 404) when the order
   * does not exist or write-rules deny access.
   *
   * Centralises the assertWriteAccess logic inside the repository so use
   * cases remain framework-free.
   */
  assertOrderWriteAccess(
    orderId: string,
    mode: 'write' | 'unlink',
    currentUser: TokenPayload | null,
  ): Promise<void>;
}
