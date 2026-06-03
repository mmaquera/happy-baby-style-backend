jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
  LoggingDecorator: {
    logUseCase: () => (_target: any, _key: any, descriptor: PropertyDescriptor) => descriptor,
  },
}), { virtual: true });

import { LogoutUserUseCase, LogoutUserRequest } from '../LogoutUserUseCase';
import type { IAuthRepository } from '../../../../domain/repositories/IAuthRepository';
import type { ILogger } from '@hbs/logging';

function makeLogger(): ILogger {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
}

function makeSession(overrides = {}) {
  return { id: 's-1', userId: 'u-1', isActive: true, sessionToken: 'tok', ...overrides };
}

function makeRepo(overrides: Partial<IAuthRepository> = {}): jest.Mocked<IAuthRepository> {
  return {
    invalidateUserSessions: jest.fn().mockResolvedValue(undefined),
    deleteSession: jest.fn().mockResolvedValue(undefined),
    findSessionsByUserId: jest.fn().mockResolvedValue([makeSession()]),
    ...overrides,
  } as any;
}

describe('LogoutUserUseCase', () => {
  it('invalidates sessions and returns response', async () => {
    const repo = makeRepo();
    const uc = new LogoutUserUseCase(repo, makeLogger());
    const req: LogoutUserRequest = { userId: 'u-1', reason: 'user_request' };
    const result = await uc.execute(req);
    expect(result.userId).toBe('u-1');
    expect(result.reason).toBe('user_request');
    expect(repo.invalidateUserSessions).toHaveBeenCalledWith('u-1');
  });

  it('deletes a specific session when sessionId is provided', async () => {
    const repo = makeRepo();
    const uc = new LogoutUserUseCase(repo, makeLogger());
    await uc.execute({ userId: 'u-1', sessionId: 's-abc' });
    expect(repo.deleteSession).toHaveBeenCalledWith('s-abc');
  });

  it('does not call deleteSession when sessionId is not provided', async () => {
    const repo = makeRepo();
    const uc = new LogoutUserUseCase(repo, makeLogger());
    await uc.execute({ userId: 'u-1' });
    expect(repo.deleteSession).not.toHaveBeenCalled();
  });

  it('propagates repository errors', async () => {
    const repo = makeRepo({
      invalidateUserSessions: jest.fn().mockRejectedValue(new Error('DB fail')),
    });
    const uc = new LogoutUserUseCase(repo, makeLogger());
    await expect(uc.execute({ userId: 'u-1' })).rejects.toThrow('DB fail');
  });
});
