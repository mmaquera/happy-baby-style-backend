jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { GetUserStatsUseCase } from '../GetUserStatsUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { UserStats } from '../../../../domain/entities/User';

function makeStats(overrides: Partial<UserStats> = {}): UserStats {
  return {
    totalUsers: 100,
    activeUsers: 80,
    newUsersThisMonth: 5,
    ...overrides,
  };
}

function makeRepo(stats: UserStats = makeStats()): jest.Mocked<Pick<IUserRepository, 'getUserStats'>> {
  return { getUserStats: jest.fn().mockResolvedValue(stats) } as any;
}

describe('GetUserStatsUseCase', () => {
  it('returns stats from the repository', async () => {
    const stats = makeStats({ totalUsers: 200, activeUsers: 150 });
    const repo = makeRepo(stats);
    const uc = new GetUserStatsUseCase(repo as any);
    const result = await uc.execute();
    expect(result.totalUsers).toBe(200);
    expect(result.activeUsers).toBe(150);
    expect(repo.getUserStats).toHaveBeenCalledTimes(1);
  });

  it('propagates repository errors', async () => {
    const repo = { getUserStats: jest.fn().mockRejectedValue(new Error('DB error')) } as any;
    const uc = new GetUserStatsUseCase(repo);
    await expect(uc.execute()).rejects.toThrow('DB error');
  });
});
