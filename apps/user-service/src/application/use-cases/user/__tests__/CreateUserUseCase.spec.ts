jest.mock(
  '@hbs/logging',
  () => ({
    LoggerFactory: {
      getInstance: () => ({
        createUseCaseLogger: () => ({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        }),
      }),
      create: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    },
  }),
  { virtual: true },
);

import { CreateUserUseCase } from '../CreateUserUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { User } from '../../../../domain/entities/User';

const makeUser = (): User => ({
  id: 'user-1',
  email: 'jane@test.com',
  role: 'customer' as any,
  isActive: true,
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
} as User);

const makeRepo = (existing: User | null = null): jest.Mocked<IUserRepository> =>
  ({
    getUserByEmail: jest.fn().mockResolvedValue(existing),
    createUser: jest.fn().mockResolvedValue(makeUser()),
  } as any);

const validRequest = () => ({
  email: 'jane@test.com',
  password: 'SecurePass1!',
  role: 'customer' as any,
  profile: { firstName: 'Jane', lastName: 'Doe' },
});

describe('CreateUserUseCase', () => {
  it('throws when the email is already registered', async () => {
    const uc = new CreateUserUseCase(makeRepo(makeUser()));
    await expect(uc.execute(validRequest())).rejects.toThrow('already exists');
  });

  it('throws when the request fails validation (invalid email)', async () => {
    const uc = new CreateUserUseCase(makeRepo());
    await expect(uc.execute({ ...validRequest(), email: 'not-an-email' })).rejects.toThrow(
      'Validation failed',
    );
  });

  it('throws when the request fails validation (weak password)', async () => {
    const uc = new CreateUserUseCase(makeRepo());
    await expect(uc.execute({ ...validRequest(), password: '123' })).rejects.toThrow(
      'Validation failed',
    );
  });

  it('creates and returns the user on success', async () => {
    const repo = makeRepo();
    const uc = new CreateUserUseCase(repo);

    const result = await uc.execute(validRequest());

    expect(result.id).toBe('user-1');
    expect(repo.createUser).toHaveBeenCalledWith(validRequest());
  });
});
