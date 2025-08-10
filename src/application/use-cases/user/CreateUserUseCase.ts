import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { CreateUserRequest, User } from '../../../domain/entities/User';
import { UserValidationService, UserRegistrationData } from '../../validation/UserValidationService';
import { LoggerFactory } from '../../../infrastructure/logging/LoggerFactory';

export class CreateUserUseCase {
  private logger = LoggerFactory.create('CreateUserUseCase');
  private validationService = new UserValidationService();

  constructor(private userRepository: IUserRepository) {}

  async execute(data: CreateUserRequest): Promise<User> {
    const traceId = `create-user-${Date.now()}`;
    
    this.logger.info('Starting user creation process', {
      email: data.email,
      traceId
    });

    try {
      // Validate input data using centralized validation service
      const validationData: UserRegistrationData = {
        email: data.email,
        password: data.password,
        firstName: data.profile?.firstName || '',
        lastName: data.profile?.lastName || '',
        phone: data.profile?.phone,
        birthDate: data.profile?.birthDate
      };

      const validation = this.validationService.validateRegistration(validationData);
      if (!validation.isValid) {
        this.logger.warn('User creation failed: validation errors', {
          email: data.email,
          errors: validation.errors,
          traceId
        });
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if user already exists
      this.logger.debug('Checking if user already exists', {
        email: data.email,
        traceId
      });

      const existingUser = await this.userRepository.getUserByEmail(data.email);
      if (existingUser) {
        this.logger.warn('User creation failed: email already exists', {
          email: data.email,
          existingUserId: existingUser.id,
          traceId
        });
        throw new Error('User with this email already exists');
      }

      // Create user
      this.logger.debug('Creating new user', {
        email: data.email,
        role: data.role,
        hasProfile: !!data.profile,
        traceId
      });

      const user = await this.userRepository.createUser(data);

      this.logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
        role: user.role,
        traceId
      });

      return user;

    } catch (error) {
      this.logger.error('User creation failed', error instanceof Error ? error : new Error(String(error)), {
        email: data.email,
        traceId
      });
      throw error;
    }
  }
} 