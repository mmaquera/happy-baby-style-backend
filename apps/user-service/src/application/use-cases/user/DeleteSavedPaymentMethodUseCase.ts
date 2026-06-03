import { ISavedPaymentMethodRepository } from '@domain/repositories/ISavedPaymentMethodRepository';
import { SavedPaymentMethod } from '@domain/entities/Payment';
import { NotFoundError, ValidationError } from '@domain/errors/DomainError';
import { LoggerFactory } from '@hbs/logging';

export interface DeleteSavedPaymentMethodInput {
  /** ID of the payment method to deactivate (soft-delete) */
  id: string;
  /** Caller's userId — used for ownership check */
  requestingUserId: string;
  /** Whether caller is admin (skips ownership requirement) */
  isAdmin: boolean;
}

export class DeleteSavedPaymentMethodUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'DeleteSavedPaymentMethodUseCase',
  );

  constructor(private readonly savedPaymentMethodRepo: ISavedPaymentMethodRepository) {}

  async execute(input: DeleteSavedPaymentMethodInput): Promise<SavedPaymentMethod> {
    if (!input.id) {
      throw new ValidationError('id is required', 'id');
    }

    const existing = await this.savedPaymentMethodRepo.findById(input.id, true);

    // CWE-203: return ambiguous NotFound for absent OR non-owned records to prevent enumeration.
    if (!existing || (!input.isAdmin && existing.userId !== input.requestingUserId)) {
      throw new NotFoundError('SavedPaymentMethod', input.id);
    }

    this.logger.info('Deactivating saved payment method (soft-delete)', {
      id: input.id,
      requestingUserId: input.requestingUserId,
    });

    const deactivated = await this.savedPaymentMethodRepo.deactivate(input.id);

    this.logger.info('Saved payment method deactivated', { id: deactivated.id });
    return deactivated;
  }
}
