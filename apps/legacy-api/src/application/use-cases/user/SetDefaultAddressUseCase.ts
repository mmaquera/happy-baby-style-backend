import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ILogger } from '@hbs/logging';
import { LoggerFactory } from '@hbs/logging';
import {
  DomainError,
  ValidationError,
  NotFoundError,
  InfrastructureError,
} from '../../../domain/errors/DomainError';

export class SetDefaultAddressUseCase {
  private readonly logger: ILogger;

  constructor(private userRepository: IUserRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('SetDefaultAddressUseCase');
  }

  async execute(userId: string, addressId: string): Promise<void> {
    const traceId = `set-default-address-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info('Starting default address setting', {
      traceId,
      userId,
      addressId,
    });

    try {
      // Validate input
      this.validateRequest(userId, addressId);

      // Check if user exists
      const user = await this.userRepository.getUserById(userId);
      if (!user) {
        throw new NotFoundError('User not found', 'USER_NOT_FOUND');
      }

      // Check if address exists and belongs to user
      const address = await this.userRepository.getUserAddressById(addressId);
      if (!address) {
        throw new NotFoundError('Address not found', 'ADDRESS_NOT_FOUND');
      }

      if (address.userId !== userId) {
        throw new ValidationError(
          'Address does not belong to the specified user',
          'ADDRESS_USER_MISMATCH',
        );
      }

      // Get current default address
      const currentDefault = await this.userRepository.getDefaultAddress(userId);

      if (currentDefault && currentDefault.id === addressId) {
        this.logger.info('Address is already the default', {
          traceId,
          addressId,
          userId,
        });
        return; // Already the default
      }

      // Update current default to false if exists
      if (currentDefault) {
        await this.userRepository.updateUserAddress(currentDefault.id, { isDefault: false });

        this.logger.info('Previous default address updated', {
          traceId,
          previousDefaultId: currentDefault.id,
          userId,
        });
      }

      // Set new default address
      await this.userRepository.setDefaultAddress(userId, addressId);

      this.logger.info('Default address set successfully', {
        traceId,
        addressId,
        userId,
      });
    } catch (error) {
      this.logger.error(
        'Error setting default address',
        error instanceof Error ? error : new Error(String(error)),
        {
          traceId,
          userId,
          addressId,
        },
      );

      if (error instanceof DomainError) {
        throw error;
      }

      throw new InfrastructureError(
        'Failed to set default address',
        error instanceof Error ? error : undefined,
      );
    }
  }

  private validateRequest(userId: string, addressId: string): void {
    const errors: string[] = [];

    if (!userId?.trim()) {
      errors.push('User ID is required');
    }

    if (!addressId?.trim()) {
      errors.push('Address ID is required');
    }

    // Validate UUID format for both IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (userId && !uuidRegex.test(userId)) {
      errors.push('Invalid user ID format');
    }

    if (addressId && !uuidRegex.test(addressId)) {
      errors.push('Invalid address ID format');
    }

    if (errors.length > 0) {
      throw new ValidationError(`Validation failed: ${errors.join(', ')}`, 'address');
    }
  }
}
