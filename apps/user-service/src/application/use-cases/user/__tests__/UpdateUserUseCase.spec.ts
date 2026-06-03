jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { UpdateUserUseCase } from '../UpdateUserUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { User } from '../../../../domain/entities/User';
import { NotFoundError, ValidationError, ConflictError } from '../../../../domain/errors/DomainError';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_UUID = '550e8400-e29b-41d4-a716-446655440001';

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

function makeRepo(overrides: Partial<IUserRepository> = {}): jest.Mocked<IUserRepository> {
  return {
    getUserById: jest.fn().mockResolvedValue(makeUser()),
    getUserByEmail: jest.fn().mockResolvedValue(null),
    updateUser: jest.fn().mockResolvedValue(makeUser({ email: 'updated@test.com' })),
    ...overrides,
  } as any;
}

describe('UpdateUserUseCase', () => {
  it('updates user when input is valid', async () => {
    const repo = makeRepo();
    const uc = new UpdateUserUseCase(repo);
    const result = await uc.execute(VALID_UUID, { email: 'updated@test.com' });
    expect(repo.updateUser).toHaveBeenCalledWith(VALID_UUID, { email: 'updated@test.com' });
    expect(result).toBeDefined();
  });

  it('throws NotFoundError when user is not found', async () => {
    const repo = makeRepo({ getUserById: jest.fn().mockResolvedValue(null) });
    const uc = new UpdateUserUseCase(repo);
    await expect(uc.execute(VALID_UUID, { email: 'x@test.com' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError for invalid UUID format', async () => {
    const repo = makeRepo();
    const uc = new UpdateUserUseCase(repo);
    await expect(uc.execute('not-a-uuid', {})).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ConflictError when new email is already taken by another user', async () => {
    const repo = makeRepo({
      getUserByEmail: jest.fn().mockResolvedValue(makeUser({ id: OTHER_UUID })),
    });
    const uc = new UpdateUserUseCase(repo);
    await expect(uc.execute(VALID_UUID, { email: 'taken@test.com' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws ValidationError for invalid email format', async () => {
    const repo = makeRepo();
    const uc = new UpdateUserUseCase(repo);
    await expect(uc.execute(VALID_UUID, { email: 'not-an-email' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws when firstName is too short', async () => {
    const repo = makeRepo();
    const uc = new UpdateUserUseCase(repo);
    await expect(uc.execute(VALID_UUID, { profile: { firstName: 'A' } })).rejects.toThrow();
  });

  it('does not throw when email belongs to the same user', async () => {
    const repo = makeRepo({
      getUserByEmail: jest.fn().mockResolvedValue(makeUser({ id: VALID_UUID })),
    });
    const uc = new UpdateUserUseCase(repo);
    await expect(uc.execute(VALID_UUID, { email: 'jane@test.com' })).resolves.toBeDefined();
  });
});
