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

import { RevokeAllUserSessionsUseCase, RevokeAllUserSessionsRequest } from '../RevokeAllUserSessionsUseCase';
import type { IAuthRepository } from '../../../../domain/repositories/IAuthRepository';
import type { ILogger } from '@hbs/logging';
import type { UserSession } from '../../../../domain/entities/Auth';
import { ValidationError } from '../../../../domain/errors/DomainError';

function makeLogger(): ILogger {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
}

function makeSession(id: string, isActive = true): UserSession {
  return {
    id,
    userId: 'user-1',
    sessionToken: `tok-${id}`,
    accessToken: `at-${id}`,
    expiresAt: new Date(Date.now() + 3600_000),
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeRepo(overrides: Partial<IAuthRepository> = {}): jest.Mocked<IAuthRepository> {
  return {
    findSessionsByUserId: jest.fn().mockResolvedValue([makeSession('s-1'), makeSession('s-2')]),
    updateSession: jest.fn().mockResolvedValue(makeSession('s-1', false)),
    deleteSessionAnalyticsBySessionId: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

const validReq = (): RevokeAllUserSessionsRequest => ({
  userId: 'user-1',
  requestingUserId: 'user-1',
});

describe('RevokeAllUserSessionsUseCase', () => {
  it('revokes all active sessions and returns count', async () => {
    const repo = makeRepo();
    const uc = new RevokeAllUserSessionsUseCase(repo, makeLogger());
    const result = await uc.execute(validReq());
    expect(result.sessionsRevoked).toBe(2);
    expect(result.userId).toBe('user-1');
    expect(repo.updateSession).toHaveBeenCalledTimes(2);
  });

  it('returns zero when there are no active sessions', async () => {
    const repo = makeRepo({
      findSessionsByUserId: jest.fn().mockResolvedValue([makeSession('s-1', false)]),
    });
    const uc = new RevokeAllUserSessionsUseCase(repo, makeLogger());
    const result = await uc.execute(validReq());
    expect(result.sessionsRevoked).toBe(0);
    expect(repo.updateSession).not.toHaveBeenCalled();
  });

  it('throws ValidationError when userId is missing', async () => {
    const repo = makeRepo();
    const uc = new RevokeAllUserSessionsUseCase(repo, makeLogger());
    await expect(uc.execute({ userId: '', requestingUserId: 'user-1' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when requestingUserId is missing', async () => {
    const repo = makeRepo();
    const uc = new RevokeAllUserSessionsUseCase(repo, makeLogger());
    await expect(uc.execute({ userId: 'user-1', requestingUserId: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('counts analyticsCleaned correctly', async () => {
    const repo = makeRepo();
    const uc = new RevokeAllUserSessionsUseCase(repo, makeLogger());
    const result = await uc.execute(validReq());
    expect(result.analyticsCleaned).toBe(2);
  });

  it('continues when analytics cleanup fails for one session', async () => {
    const repo = makeRepo({
      deleteSessionAnalyticsBySessionId: jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('analytics fail')),
    });
    const uc = new RevokeAllUserSessionsUseCase(repo, makeLogger());
    const result = await uc.execute(validReq());
    expect(result.sessionsRevoked).toBe(2);
    expect(result.analyticsCleaned).toBe(1);
  });
});
