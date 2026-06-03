import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { UpdateUserRequest, User } from '../../../domain/entities/User';
import { NotFoundError, ValidationError, ConflictError } from '../../../domain/errors/DomainError';

export class UpdateUserUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(id: string, data: UpdateUserRequest): Promise<User> {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new ValidationError('Invalid user ID format', 'id');
    }

    // Check if user exists
    const existingUser = await this.userRepository.getUserById(id);
    if (!existingUser) {
      throw new NotFoundError('User', id);
    }

    // Validate email format if provided
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new ValidationError('Invalid email format', 'email');
      }

      // Check if email is already taken by another user
      const userWithEmail = await this.userRepository.getUserByEmail(data.email);
      if (userWithEmail && userWithEmail.id !== id) {
        throw new ConflictError('Email is already taken by another user');
      }
    }

    // Validate profile data if provided
    if (data.profile) {
      if (data.profile.firstName !== undefined && data.profile.firstName.length < 2) {
        throw new ValidationError('First name must be at least 2 characters long', 'firstName');
      }

      if (data.profile.lastName !== undefined && data.profile.lastName.length < 2) {
        throw new ValidationError('Last name must be at least 2 characters long', 'lastName');
      }

      // Validate phone number if provided
      if (data.profile.phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(data.profile.phone.replace(/\s/g, ''))) {
          throw new ValidationError('Invalid phone number format', 'phone');
        }
      }

      // Validate birth date if provided
      if (data.profile.birthDate) {
        const birthDate = new Date(data.profile.birthDate);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();

        if (age < 13 || age > 120) {
          throw new ValidationError(
            'Birth date must be for a person between 13 and 120 years old',
            'birthDate',
          );
        }
      }
    }

    // Update user
    const updatedUser = await this.userRepository.updateUser(id, data);

    return updatedUser;
  }
}
