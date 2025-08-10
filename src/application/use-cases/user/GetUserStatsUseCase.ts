import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { UserStats } from '../../../domain/entities/User';

export class GetUserStatsUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(): Promise<UserStats> {
    return await this.userRepository.getUserStats();
  }
} 