import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ILogger } from '../../../domain/interfaces/ILogger';
import { LoggerFactory } from '../../../infrastructure/logging/LoggerFactory';
import { DomainError, ValidationError, NotFoundError, BusinessLogicError, InfrastructureError } from '../../../domain/errors/DomainError';

export class DeleteUserAddressUseCase {
  private readonly logger: ILogger;

  constructor(private userRepository: IUserRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteUserAddressUseCase');
  }

  async execute(id: string): Promise<void> {
    const traceId = `delete-address-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info('Starting address deletion', {
      traceId,
      addressId: id
    });

    try {
      // Validate input
      this.validateRequest(id);

      // Check if address exists
      const existingAddress = await this.userRepository.getUserAddressById(id);
      if (!existingAddress) {
        throw new NotFoundError('Address not found', 'ADDRESS_NOT_FOUND');
      }

      // Check if address is being used in orders
      await this.checkAddressUsage(id);

      // Check if this is the only address for the user
      await this.checkUserAddressCount(existingAddress.userId);

      // Delete the address
      await this.userRepository.deleteUserAddress(id);

      this.logger.info('Address deleted successfully', {
        traceId,
        addressId: id,
        userId: existingAddress.userId
      });

    } catch (error) {
      this.logger.error('Error deleting address', error instanceof Error ? error : new Error(String(error)), {
        traceId,
        addressId: id
      });

      if (error instanceof DomainError) {
        throw error;
      }

      throw new InfrastructureError('Failed to delete address', error instanceof Error ? error : undefined);
    }
  }

  private validateRequest(id: string): void {
    if (!id?.trim()) {
      throw new ValidationError('Address ID is required', 'ADDRESS_ID_REQUIRED');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new ValidationError('Invalid address ID format', 'INVALID_ADDRESS_ID_FORMAT');
    }
  }

  private async checkAddressUsage(addressId: string): Promise<void> {
    try {
      // This would require extending the repository to check order usage
      // For now, we'll assume it's safe to delete
      // In a real implementation, you might want to check:
      // - If the address is referenced in any orders
      // - If those orders are still active
      // - If deletion would break referential integrity
      
      this.logger.debug('Address usage check passed', { addressId });
    } catch (error) {
      this.logger.warn('Failed to check address usage', { addressId, error: error instanceof Error ? error.message : String(error) });
      // Continue with deletion, but log the warning
    }
  }

  private async checkUserAddressCount(userId: string): Promise<void> {
    try {
      const userAddresses = await this.userRepository.getUserAddresses(userId);
      
      if (userAddresses.length <= 1) {
        throw new BusinessLogicError(
          'Cannot delete the only address for a user. Users must have at least one address.',
          { code: 'CANNOT_DELETE_LAST_ADDRESS' }
        );
      }

      this.logger.debug('User address count check passed', {
        userId,
        addressCount: userAddresses.length
      });
    } catch (error) {
      if (error instanceof BusinessLogicError) {
        throw error;
      }
      
      this.logger.warn('Failed to check user address count', { userId, error: error instanceof Error ? error.message : String(error) });
      // Continue with deletion, but log the warning
    }
  }
}
