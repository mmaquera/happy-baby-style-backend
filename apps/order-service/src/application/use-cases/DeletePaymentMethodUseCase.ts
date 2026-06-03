import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import type { IPaymentMethodRepository } from '../../domain/repositories/IPaymentMethodRepository';

export interface DeletePaymentMethodResult {
  success: boolean;
  message: string;
}

export class DeletePaymentMethodUseCase {
  private readonly logger: ILogger;

  constructor(private readonly paymentMethodRepository: IPaymentMethodRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeletePaymentMethodUseCase');
  }

  /**
   * Delete a PaymentMethod by id.
   *
   * Authorization flow:
   *   1. Load the PaymentMethod to obtain its orderId.
   *      If not found → ambiguous 'Operation completed' (M-2: no existence confirmation).
   *   2. assertOrderWriteAccess on the parent Order (unlink mode). If the Order does
   *      not exist or unlink-rules deny access → NotFoundError (ambiguous 404).
   *   3. Delete the record.
   *
   * Return: ALWAYS { success: true, message: 'Operation completed' } — M-2 anti-enumeration.
   * Captures Prisma P2025 and existing-check failures silently.
   */
  async execute(id: string, currentUser: TokenPayload): Promise<DeletePaymentMethodResult> {
    try {
      // Step 1: load to get orderId.
      const existing = await this.paymentMethodRepository.findById(id);
      if (!existing) {
        this.logger.info('DeletePaymentMethod: record not found (ambiguous)', { paymentMethodId: id, userId: currentUser.userId });
        return { success: true, message: 'Operation completed' };
      }

      // Step 2: enforce unlink-access on the parent Order.
      await this.paymentMethodRepository.assertOrderWriteAccess(
        existing.orderId,
        'unlink',
        currentUser,
      );

      // Step 3: delete.
      await this.paymentMethodRepository.delete(id);

      this.logger.info('PaymentMethod deleted', {
        paymentMethodId: id,
        orderId: existing.orderId,
        userId: currentUser.userId,
      });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        this.logger.info('DeletePaymentMethod: P2025 (ambiguous)', { paymentMethodId: id, userId: currentUser.userId });
      } else {
        this.logger.error('DeletePaymentMethod: unexpected error', err instanceof Error ? err : new Error(String(err)), { paymentMethodId: id });
        throw err;
      }
    }
    return { success: true, message: 'Operation completed' };
  }
}
