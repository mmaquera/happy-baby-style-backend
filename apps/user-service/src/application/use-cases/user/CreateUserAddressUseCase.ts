import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { UserAddress, CreateUserAddressRequest } from '../../../domain/entities/User';
import { ILogger } from '@hbs/logging';
import { LoggerFactory } from '@hbs/logging';
import { DomainError, ValidationError, ConflictError, NotFoundError, InfrastructureError } from '../../../domain/errors/DomainError';
import { AddressValidationService } from '../../validation/AddressValidationService';

export class CreateUserAddressUseCase {
  private readonly logger: ILogger;
  private readonly validationService: AddressValidationService;

  constructor(private userRepository: IUserRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateUserAddressUseCase');
    this.validationService = new AddressValidationService();
  }

  async execute(request: CreateUserAddressRequest): Promise<UserAddress> {
    const traceId = `create-address-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info('Starting address creation', {
      traceId,
      userId: request.userId,
      addressType: request.title
    });

    try {
      // Validate input
      const validationResult = this.validationService.validateAddressInput({
        title: request.title,
        firstName: request.firstName,
        lastName: request.lastName,
        addressLine1: request.addressLine1,
        addressLine2: request.addressLine2,
        city: request.city,
        state: request.state,
        postalCode: request.postalCode,
        country: request.country || 'PE',
        isDefault: request.isDefault
      });

      if (!validationResult.isValid) {
        throw new ValidationError(`Validation failed: ${validationResult.errors.join(', ')}`, 'address');
      }

      // Check if user exists
      const user = await this.userRepository.getUserById(request.userId);
      if (!user) {
        throw new NotFoundError('User', request.userId);
      }

      // If this is the first address or marked as default, set it as default
      if (request.isDefault) {
        await this.setAsDefaultAddress(request.userId);
      }

      // Create the address
      const address = await this.userRepository.createUserAddress(request);

      this.logger.info('Address created successfully', {
        traceId,
        addressId: address.id,
        userId: address.userId,
        addressType: address.title
      });

      return address;

    } catch (error) {
      this.logger.error('Error creating address', error instanceof Error ? error : new Error(String(error)), {
        traceId,
        userId: request.userId,
        request
      });

      if (error instanceof DomainError) {
        throw error;
      }

      throw new InfrastructureError('Failed to create address', error instanceof Error ? error : undefined);
    }
  }



  private async setAsDefaultAddress(userId: string): Promise<void> {
    try {
      // Get current default address
      const currentDefault = await this.userRepository.getDefaultAddress(userId);
      
      if (currentDefault) {
        // Update current default to false
        await this.userRepository.updateUserAddress(currentDefault.id, { isDefault: false });
        
        this.logger.info('Previous default address updated', {
          addressId: currentDefault.id,
          userId
        });
      }
    } catch (error) {
      this.logger.warn('Failed to update previous default address', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw error, continue with creation
    }
  }
}
