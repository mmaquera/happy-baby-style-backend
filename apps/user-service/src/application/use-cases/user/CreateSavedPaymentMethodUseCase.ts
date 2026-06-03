import { ISavedPaymentMethodRepository } from '@domain/repositories/ISavedPaymentMethodRepository';
import {
  SavedPaymentMethod,
  CreateSavedPaymentMethodRequest,
  PaymentMethodType,
} from '@domain/entities/Payment';
import { ValidationError } from '@domain/errors/DomainError';
import { LoggerFactory } from '@hbs/logging';

const VALID_PAYMENT_TYPES: PaymentMethodType[] = [
  'credit_card',
  'debit_card',
  'paypal',
  'bank_transfer',
  'cash_on_delivery',
];

export class CreateSavedPaymentMethodUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'CreateSavedPaymentMethodUseCase',
  );

  constructor(private readonly savedPaymentMethodRepo: ISavedPaymentMethodRepository) {}

  async execute(request: CreateSavedPaymentMethodRequest): Promise<SavedPaymentMethod> {
    if (!request.userId) {
      throw new ValidationError('userId is required', 'userId');
    }
    if (!request.type || !VALID_PAYMENT_TYPES.includes(request.type)) {
      throw new ValidationError(
        `type must be one of: ${VALID_PAYMENT_TYPES.join(', ')}`,
        'type',
      );
    }
    if (!request.provider) {
      throw new ValidationError('provider is required', 'provider');
    }

    this.logger.info('Creating saved payment method', {
      userId: request.userId,
      type: request.type,
      provider: request.provider,
    });

    const method = await this.savedPaymentMethodRepo.create(request);

    this.logger.info('Saved payment method created', { id: method.id, userId: request.userId });
    return method;
  }
}
