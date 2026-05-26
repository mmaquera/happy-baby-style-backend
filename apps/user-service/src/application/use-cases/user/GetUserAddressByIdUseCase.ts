import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { UserAddress } from '../../../domain/entities/User';
import { ILogger } from '@hbs/logging';
import { LoggerFactory } from '@hbs/logging';
import { DomainError, ValidationError, NotFoundError, InfrastructureError } from '../../../domain/errors/DomainError';

export class GetUserAddressByIdUseCase {
  private readonly logger: ILogger;

  constructor(private userRepository: IUserRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetUserAddressByIdUseCase');
  }

  async execute(id: string): Promise<UserAddress> {
    const traceId = `get-address-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info('Starting address retrieval by ID', {
      traceId,
      addressId: id
    });

    try {
      // Validate input
      this.validateRequest(id);

      // Get the address
      const address = await this.userRepository.getUserAddressById(id);
      
      if (!address) {
        throw new NotFoundError('Address not found', 'ADDRESS_NOT_FOUND');
      }

      this.logger.info('Address retrieved successfully', {
        traceId,
        addressId: id,
        userId: address.userId
      });

      return address;

    } catch (error) {
      this.logger.error('Error retrieving address', error instanceof Error ? error : new Error(String(error)), {
        traceId,
        addressId: id
      });

      if (error instanceof DomainError) {
        throw error;
      }

      throw new InfrastructureError('Failed to retrieve address', error instanceof Error ? error : undefined);
    }
  }

  private validateRequest(id: string): void {
    if (!id?.trim()) {
      throw new ValidationError('Address ID is required', 'addressId');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new ValidationError('Invalid address ID format', 'addressId');
    }
  }
}
