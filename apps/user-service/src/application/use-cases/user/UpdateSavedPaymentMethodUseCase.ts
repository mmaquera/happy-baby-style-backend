import { ISavedPaymentMethodRepository } from '@domain/repositories/ISavedPaymentMethodRepository';
import {
  SavedPaymentMethod,
  UpdateSavedPaymentMethodRequest,
} from '@domain/entities/Payment';
import { NotFoundError, ValidationError, ForbiddenError } from '@domain/errors/DomainError';
import { LoggerFactory } from '@hbs/logging';

export interface UpdateSavedPaymentMethodInput {
  /** ID of the payment method to update */
  id: string;
  /** Caller's userId — used for ownership check */
  requestingUserId: string;
  /** Whether caller is admin (skips ownership requirement) */
  isAdmin: boolean;
  data: UpdateSavedPaymentMethodRequest;
}

export class UpdateSavedPaymentMethodUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'UpdateSavedPaymentMethodUseCase',
  );

  constructor(private readonly savedPaymentMethodRepo: ISavedPaymentMethodRepository) {}

  async execute(input: UpdateSavedPaymentMethodInput): Promise<SavedPaymentMethod> {
    if (!input.id) {
      throw new ValidationError('id is required', 'id');
    }

    // Load including inactive so admins can see the record exists, but we still guard non-owners.
    const existing = await this.savedPaymentMethodRepo.findById(input.id, true);

    // CWE-203: return ambiguous NotFound for absent OR non-owned records to prevent enumeration.
    if (!existing || (!input.isAdmin && existing.userId !== input.requestingUserId)) {
      throw new NotFoundError('SavedPaymentMethod', input.id);
    }

    // Only active methods can be updated by non-owners (owners cannot "resurrect" deactivated methods).
    if (!existing.isActive && !input.isAdmin) {
      throw new ForbiddenError('Cannot update a deactivated payment method');
    }

    this.logger.info('Updating saved payment method', {
      id: input.id,
      requestingUserId: input.requestingUserId,
    });

    const updated = await this.savedPaymentMethodRepo.update(input.id, input.data);

    this.logger.info('Saved payment method updated', { id: updated.id });
    return updated;
  }
}
