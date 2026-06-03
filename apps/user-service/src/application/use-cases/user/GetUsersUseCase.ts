import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { User } from '../../../domain/entities/User';
import { ValidationError } from '../../../domain/errors/DomainError';

export interface GetUsersFilters {
  limit?: number;
  offset?: number;
  isActive?: boolean;
  search?: string;
}

export class GetUsersUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(filters: GetUsersFilters = {}): Promise<User[]> {
    const { limit = 50, offset = 0, isActive, search } = filters;

    // Validate pagination parameters
    if (limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100', 'limit');
    }

    if (offset < 0) {
      throw new ValidationError('Offset must be non-negative', 'offset');
    }

    // If search is provided, use search method
    if (search && search.trim().length > 0) {
      return await this.userRepository.searchUsers(search.trim());
    }

    // Otherwise use regular get method with filters
    const result = await this.userRepository.getUsers(limit, offset, isActive);
    return result.users;
  }
}
