import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { User, UserRole } from '../../../domain/entities/User';

export interface GetUsersFilters {
  limit?: number;
  offset?: number;
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

export class GetUsersUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(filters: GetUsersFilters = {}): Promise<User[]> {
    const { limit = 50, offset = 0, role, isActive, search } = filters;

    // Validate pagination parameters
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    if (offset < 0) {
      throw new Error('Offset must be non-negative');
    }

    // If search is provided, use search method
    if (search && search.trim().length > 0) {
      return await this.userRepository.searchUsers(search.trim());
    }

    // Otherwise use regular get method with filters
    const result = await this.userRepository.getUsers(limit, offset, role, isActive);
    return result.users;
  }
} 