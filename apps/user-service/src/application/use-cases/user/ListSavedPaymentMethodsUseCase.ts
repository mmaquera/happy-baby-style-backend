import { ISavedPaymentMethodRepository } from '@domain/repositories/ISavedPaymentMethodRepository';
import { SavedPaymentMethod } from '@domain/entities/Payment';
import { ValidationError } from '@domain/errors/DomainError';
import { LoggerFactory } from '@hbs/logging';

export interface ListSavedPaymentMethodsRequest {
  userId: string;
  includeInactive?: boolean;
}

export class ListSavedPaymentMethodsUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'ListSavedPaymentMethodsUseCase',
  );

  constructor(private readonly savedPaymentMethodRepo: ISavedPaymentMethodRepository) {}

  async execute(request: ListSavedPaymentMethodsRequest): Promise<SavedPaymentMethod[]> {
    if (!request.userId) {
      throw new ValidationError('userId is required', 'userId');
    }

    this.logger.info('Listing saved payment methods', {
      userId: request.userId,
      includeInactive: request.includeInactive,
    });

    const methods = await this.savedPaymentMethodRepo.findByUserId(
      request.userId,
      request.includeInactive ?? false,
    );

    this.logger.info('Saved payment methods listed', {
      userId: request.userId,
      count: methods.length,
    });

    return methods;
  }
}
