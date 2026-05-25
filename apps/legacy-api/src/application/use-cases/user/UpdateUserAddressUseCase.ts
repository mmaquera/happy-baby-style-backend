import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { UserAddress, UpdateUserAddressRequest } from '../../../domain/entities/User';
import { ILogger } from '../../../domain/interfaces/ILogger';
import { LoggerFactory } from '../../../infrastructure/logging/LoggerFactory';
import { DomainError, ValidationError, NotFoundError, InfrastructureError } from '../../../domain/errors/DomainError';

export class UpdateUserAddressUseCase {
  private readonly logger: ILogger;

  constructor(private userRepository: IUserRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateUserAddressUseCase');
  }

  async execute(id: string, request: UpdateUserAddressRequest): Promise<UserAddress> {
    const traceId = `update-address-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info('Starting address update', {
      traceId,
      addressId: id,
      updates: Object.keys(request)
    });

    try {
      // Validate input
      this.validateRequest(request);

      // Check if address exists
      const existingAddress = await this.userRepository.getUserAddressById(id);
      if (!existingAddress) {
        throw new NotFoundError('Address not found', 'ADDRESS_NOT_FOUND');
      }

      // If setting as default, update other addresses
      if (request.isDefault === true) {
        await this.setAsDefaultAddress(existingAddress.userId, id);
      }

      // Update the address
      const updatedAddress = await this.userRepository.updateUserAddress(id, request);

      this.logger.info('Address updated successfully', {
        traceId,
        addressId: id,
        userId: updatedAddress.userId,
        updates: Object.keys(request)
      });

      return updatedAddress;

    } catch (error) {
      this.logger.error('Error updating address', error instanceof Error ? error : new Error(String(error)), {
        traceId,
        addressId: id,
        request
      });

      if (error instanceof DomainError) {
        throw error;
      }

      throw new InfrastructureError('Failed to update address', error instanceof Error ? error : undefined);
    }
  }

  private validateRequest(request: UpdateUserAddressRequest): void {
    const errors: string[] = [];

    // Check if at least one field is provided
    const hasUpdates = Object.keys(request).some(key => request[key as keyof UpdateUserAddressRequest] !== undefined);
    if (!hasUpdates) {
      errors.push('At least one field must be provided for update');
    }

    // Validate individual fields if provided
    if (request.title !== undefined && !request.title.trim()) {
      errors.push('Address title cannot be empty');
    }

    if (request.firstName !== undefined && !request.firstName.trim()) {
      errors.push('First name cannot be empty');
    }

    if (request.lastName !== undefined && !request.lastName.trim()) {
      errors.push('Last name cannot be empty');
    }

    if (request.addressLine1 !== undefined && !request.addressLine1.trim()) {
      errors.push('Address line 1 cannot be empty');
    }

    if (request.city !== undefined && !request.city.trim()) {
      errors.push('City cannot be empty');
    }

    if (request.state !== undefined && !request.state.trim()) {
      errors.push('State cannot be empty');
    }

    if (request.postalCode !== undefined && !request.postalCode.trim()) {
      errors.push('Postal code cannot be empty');
    }

    if (request.country !== undefined && !request.country.trim()) {
      errors.push('Country cannot be empty');
    }

    if (errors.length > 0) {
      throw new ValidationError(`Validation failed: ${errors.join(', ')}`, 'address');
    }
  }

  private async setAsDefaultAddress(userId: string, addressId: string): Promise<void> {
    try {
      // Get current default address
      const currentDefault = await this.userRepository.getDefaultAddress(userId);
      
      if (currentDefault && currentDefault.id !== addressId) {
        // Update current default to false
        await this.userRepository.updateUserAddress(currentDefault.id, { isDefault: false });
        
        this.logger.info('Previous default address updated', {
          addressId: currentDefault.id,
          userId,
          newDefaultId: addressId
        });
      }
    } catch (error) {
      this.logger.warn('Failed to update previous default address', { userId, addressId, error: error instanceof Error ? error.message : String(error) });
      // Don't throw error, continue with update
    }
  }
}
