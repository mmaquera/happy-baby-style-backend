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

import { RevokeUserSessionUseCase, RevokeUserSessionRequest } from '../RevokeUserSessionUseCase';
import type { IAuthRepository } from '../../../../domain/repositories/IAuthRepository';
import type { ILogger } from '@hbs/logging';
import type { UserSession } from '../../../../domain/entities/Auth';
import { ValidationError, NotFoundError, UnauthorizedError } from '../../../../domain/errors/DomainError';

function makeLogger(): ILogger {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
}

function makeSession(overrides: Partial<UserSession> = {}): UserSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    sessionToken: 'tok-abc',
    accessToken: 'at-abc',
    expiresAt: new Date(Date.now() + 3600_000),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<IAuthRepository> = {}): jest.Mocked<IAuthRepository> {
  return {
    findSessionByToken: jest.fn().mockResolvedValue(makeSession()),
    updateSession: jest.fn().mockResolvedValue(makeSession({ isActive: false })),
    deleteSessionAnalyticsBySessionId: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

const validReq = (): RevokeUserSessionRequest => ({
  sessionId: 'session-1',
  userId: 'user-1',
});

describe('RevokeUserSessionUseCase', () => {
  it('revokes an active session successfully', async () => {
    const repo = makeRepo();
    const uc = new RevokeUserSessionUseCase(repo, makeLogger());
    const result = await uc.execute(validReq());
    expect(result.sessionId).toBe('session-1');
    expect(repo.updateSession).toHaveBeenCalledWith('session-1', expect.objectContaining({ isActive: false }));
  });

  it('throws NotFoundError when session does not exist', async () => {
    const repo = makeRepo({ findSessionByToken: jest.fn().mockResolvedValue(null) });
    const uc = new RevokeUserSessionUseCase(repo, makeLogger());
    await expect(uc.execute(validReq())).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws UnauthorizedError when session belongs to a different user', async () => {
    const repo = makeRepo({
      findSessionByToken: jest.fn().mockResolvedValue(makeSession({ userId: 'other-user' })),
    });
    const uc = new RevokeUserSessionUseCase(repo, makeLogger());
    await expect(uc.execute(validReq())).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('returns without updating when session is already inactive', async () => {
    const repo = makeRepo({
      findSessionByToken: jest.fn().mockResolvedValue(makeSession({ isActive: false })),
    });
    const uc = new RevokeUserSessionUseCase(repo, makeLogger());
    const result = await uc.execute(validReq());
    expect(result.analyticsCleaned).toBe(false);
    expect(repo.updateSession).not.toHaveBeenCalled();
  });

  it('throws ValidationError when sessionId is missing', async () => {
    const repo = makeRepo();
    const uc = new RevokeUserSessionUseCase(repo, makeLogger());
    await expect(uc.execute({ sessionId: '', userId: 'user-1' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('continues revocation even if analytics cleanup fails', async () => {
    const repo = makeRepo({
      deleteSessionAnalyticsBySessionId: jest.fn().mockRejectedValue(new Error('analytics error')),
    });
    const uc = new RevokeUserSessionUseCase(repo, makeLogger());
    const result = await uc.execute(validReq());
    expect(result.analyticsCleaned).toBe(false);
    expect(repo.updateSession).toHaveBeenCalled();
  });
});
