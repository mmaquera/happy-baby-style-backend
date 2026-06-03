jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { GetUserByIdUseCase } from '../GetUserByIdUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { User } from '../../../../domain/entities/User';
import { NotFoundError, ValidationError } from '../../../../domain/errors/DomainError';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: VALID_UUID,
    email: 'jane@test.com',
    isActive: true,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(user: User | null = makeUser()): jest.Mocked<Pick<IUserRepository, 'getUserById'>> {
  return { getUserById: jest.fn().mockResolvedValue(user) } as any;
}

describe('GetUserByIdUseCase', () => {
  it('returns the user for a valid UUID', async () => {
    const repo = makeRepo();
    const uc = new GetUserByIdUseCase(repo as any);
    const result = await uc.execute(VALID_UUID);
    expect(result.id).toBe(VALID_UUID);
    expect(repo.getUserById).toHaveBeenCalledWith(VALID_UUID);
  });

  it('throws NotFoundError when the user is not found', async () => {
    const repo = makeRepo(null);
    const uc = new GetUserByIdUseCase(repo as any);
    await expect(uc.execute(VALID_UUID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError for an invalid UUID format', async () => {
    const repo = makeRepo();
    const uc = new GetUserByIdUseCase(repo as any);
    await expect(uc.execute('not-a-uuid')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for an empty string id', async () => {
    const repo = makeRepo();
    const uc = new GetUserByIdUseCase(repo as any);
    await expect(uc.execute('')).rejects.toBeInstanceOf(ValidationError);
  });
});
