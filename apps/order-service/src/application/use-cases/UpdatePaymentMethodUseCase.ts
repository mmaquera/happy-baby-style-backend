import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type {
  IPaymentMethodRepository,
  PaymentMethodData,
  UpdatePaymentMethodInput,
} from '../../domain/repositories/IPaymentMethodRepository';

export class UpdatePaymentMethodUseCase {
  private readonly logger: ILogger;

  constructor(private readonly paymentMethodRepository: IPaymentMethodRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdatePaymentMethodUseCase');
  }

  /**
   * Update a PaymentMethod by id.
   *
   * Authorization flow:
   *   1. Load the PaymentMethod to obtain its orderId. If not found → NotFoundError.
   *   2. assertOrderWriteAccess on the parent Order (write mode). If the Order does not
   *      exist or write-rules deny access → NotFoundError (ambiguous 404).
   *   3. Apply the update.
   *
   * The ambiguous 404 prevents resource-existence enumeration (BOLA / CWE-639).
   */
  async execute(
    id: string,
    input: UpdatePaymentMethodInput,
    currentUser: TokenPayload,
  ): Promise<PaymentMethodData> {
    // Step 1: load to get orderId.
    const existing = await this.paymentMethodRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('PaymentMethod', id);
    }

    // Step 2: enforce write-access on the parent Order.
    await this.paymentMethodRepository.assertOrderWriteAccess(
      existing.orderId,
      'write',
      currentUser,
    );

    // Step 3: persist.
    const updated = await this.paymentMethodRepository.update(id, input);

    this.logger.info('PaymentMethod updated', {
      paymentMethodId: id,
      orderId: existing.orderId,
      userId: currentUser.userId,
    });

    return updated;
  }
}
