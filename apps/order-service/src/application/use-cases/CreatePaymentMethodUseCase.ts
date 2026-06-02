import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import type {
  IPaymentMethodRepository,
  PaymentMethodData,
  CreatePaymentMethodInput,
} from '../../domain/repositories/IPaymentMethodRepository';

export class CreatePaymentMethodUseCase {
  private readonly logger: ILogger;

  constructor(private readonly paymentMethodRepository: IPaymentMethodRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreatePaymentMethodUseCase');
  }

  /**
   * Create a PaymentMethod for the given order.
   *
   * Authorization: the parent Order must be writable by currentUser.
   * assertOrderWriteAccess (delegated to the repository) throws NotFoundError
   * (ambiguous 404) when the Order does not exist or write-rules deny access —
   * preventing resource-existence enumeration (BOLA / CWE-639 mitigation).
   *
   * @param input        - PaymentMethod fields including the target orderId.
   * @param currentUser  - Authenticated user from JWT context. Never null for mutations.
   */
  async execute(
    input: CreatePaymentMethodInput,
    currentUser: TokenPayload,
  ): Promise<PaymentMethodData> {
    // Guard: verify write access on the parent Order before creating the PaymentMethod.
    await this.paymentMethodRepository.assertOrderWriteAccess(
      input.orderId,
      'write',
      currentUser,
    );

    const paymentMethod = await this.paymentMethodRepository.create(input);

    this.logger.info('PaymentMethod created', {
      paymentMethodId: paymentMethod.id,
      orderId: paymentMethod.orderId,
      userId: currentUser.userId,
    });

    return paymentMethod;
  }
}
