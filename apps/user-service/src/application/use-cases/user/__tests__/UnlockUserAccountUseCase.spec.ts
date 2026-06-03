jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { UnlockUserAccountUseCase, UnlockUserAccountRequest } from '../UnlockUserAccountUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { ISecurityEventRepository } from '../../../../domain/repositories/ISecurityEventRepository';
import type { User } from '../../../../domain/entities/User';
import type { ILogger } from '@hbs/logging';
import { NotFoundError } from '../../../../domain/errors/DomainError';

function makeLogger(): ILogger {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
}

function makeUser(): User {
  return {
    id: 'user-1',
    email: 'jane@test.com',
    isActive: true,
    emailVerified: false,
    failedLoginAttempts: 5,
    lockedUntil: new Date(Date.now() + 3600_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeUserRepo(overrides: Partial<IUserRepository> = {}): jest.Mocked<IUserRepository> {
  return {
    getUserById: jest.fn().mockResolvedValue(makeUser()),
    resetUserLockout: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

function makeSecurityRepo(): jest.Mocked<ISecurityEventRepository> {
  return { create: jest.fn().mockResolvedValue({}) } as any;
}

const validReq = (): UnlockUserAccountRequest => ({
  targetUserId: 'user-1',
  adminUserId: 'admin-1',
});

describe('UnlockUserAccountUseCase', () => {
  it('unlocks user account successfully', async () => {
    const userRepo = makeUserRepo();
    const uc = new UnlockUserAccountUseCase(userRepo, makeSecurityRepo(), makeLogger());
    const result = await uc.execute(validReq());
    expect(result.success).toBe(true);
    expect(result.userId).toBe('user-1');
    expect(userRepo.resetUserLockout).toHaveBeenCalledWith('user-1');
  });

  it('throws NotFoundError when user does not exist', async () => {
    const userRepo = makeUserRepo({ getUserById: jest.fn().mockResolvedValue(null) });
    const uc = new UnlockUserAccountUseCase(userRepo, makeSecurityRepo(), makeLogger());
    await expect(uc.execute(validReq())).rejects.toBeInstanceOf(NotFoundError);
  });

  it('still unlocks account even if security event creation fails', async () => {
    const userRepo = makeUserRepo();
    const securityRepo = { create: jest.fn().mockRejectedValue(new Error('event fail')) } as any;
    const uc = new UnlockUserAccountUseCase(userRepo, securityRepo, makeLogger());
    const result = await uc.execute(validReq());
    expect(result.success).toBe(true);
    expect(userRepo.resetUserLockout).toHaveBeenCalled();
  });
});
