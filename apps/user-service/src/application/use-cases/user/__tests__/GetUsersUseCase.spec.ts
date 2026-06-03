jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { GetUsersUseCase } from '../GetUsersUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { User } from '../../../../domain/entities/User';

function makeUser(id = 'u-1'): User {
  return {
    id,
    email: `user${id}@test.com`,
    isActive: true,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeRepo(overrides: Partial<IUserRepository> = {}): jest.Mocked<IUserRepository> {
  return {
    getUsers: jest.fn().mockResolvedValue({ users: [makeUser()], total: 1 }),
    searchUsers: jest.fn().mockResolvedValue([makeUser()]),
    ...overrides,
  } as any;
}

describe('GetUsersUseCase', () => {
  it('returns users with default pagination', async () => {
    const repo = makeRepo();
    const uc = new GetUsersUseCase(repo);
    const result = await uc.execute();
    expect(result).toHaveLength(1);
    expect(repo.getUsers).toHaveBeenCalledWith(50, 0, undefined);
  });

  it('delegates to searchUsers when search is provided', async () => {
    const repo = makeRepo();
    const uc = new GetUsersUseCase(repo);
    await uc.execute({ search: 'jane' });
    expect(repo.searchUsers).toHaveBeenCalledWith('jane');
    expect(repo.getUsers).not.toHaveBeenCalled();
  });

  it('passes isActive filter through', async () => {
    const repo = makeRepo();
    const uc = new GetUsersUseCase(repo);
    await uc.execute({ isActive: true, limit: 10, offset: 5 });
    expect(repo.getUsers).toHaveBeenCalledWith(10, 5, true);
  });

  it('throws when limit is out of range (>100)', async () => {
    const repo = makeRepo();
    const uc = new GetUsersUseCase(repo);
    await expect(uc.execute({ limit: 200 })).rejects.toThrow();
  });

  it('throws when limit is 0', async () => {
    const repo = makeRepo();
    const uc = new GetUsersUseCase(repo);
    await expect(uc.execute({ limit: 0 })).rejects.toThrow();
  });

  it('throws when offset is negative', async () => {
    const repo = makeRepo();
    const uc = new GetUsersUseCase(repo);
    await expect(uc.execute({ offset: -1 })).rejects.toThrow();
  });
});
