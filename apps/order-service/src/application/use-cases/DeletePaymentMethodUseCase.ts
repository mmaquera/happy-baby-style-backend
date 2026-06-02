import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IPaymentMethodRepository } from '../../domain/repositories/IPaymentMethodRepository';

export class DeletePaymentMethodUseCase {
  private readonly logger: ILogger;

  constructor(private readonly paymentMethodRepository: IPaymentMethodRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeletePaymentMethodUseCase');
  }

  /**
   * Delete a PaymentMethod by id.
   *
   * Authorization flow:
   *   1. Load the PaymentMethod to obtain its orderId. If not found → NotFoundError.
   *   2. assertOrderWriteAccess on the parent Order (unlink mode). If the Order does
   *      not exist or unlink-rules deny access → NotFoundError (ambiguous 404).
   *   3. Delete the record.
   */
  async execute(id: string, currentUser: TokenPayload): Promise<boolean> {
    // Step 1: load to get orderId.
    const existing = await this.paymentMethodRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('PaymentMethod', id);
    }

    // Step 2: enforce unlink-access on the parent Order.
    await this.paymentMethodRepository.assertOrderWriteAccess(
      existing.orderId,
      'unlink',
      currentUser,
    );

    // Step 3: delete.
    const result = await this.paymentMethodRepository.delete(id);

    this.logger.info('PaymentMethod deleted', {
      paymentMethodId: id,
      orderId: existing.orderId,
      userId: currentUser.userId,
    });

    return result;
  }
}
