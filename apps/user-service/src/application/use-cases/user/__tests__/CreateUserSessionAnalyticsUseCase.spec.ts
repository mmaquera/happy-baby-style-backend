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

import { CreateUserSessionAnalyticsUseCase } from '../CreateUserSessionAnalyticsUseCase';
import type { IAuthRepository } from '../../../../domain/repositories/IAuthRepository';
import type { ILogger } from '@hbs/logging';
import type { UserSessionAnalytics } from '../../../../domain/entities/Auth';
import { ValidationError } from '../../../../domain/errors/DomainError';

function makeLogger(): ILogger {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
}

function makeAnalytics(overrides: Partial<UserSessionAnalytics> = {}): UserSessionAnalytics {
  return {
    id: 'analytics-1',
    sessionId: 'session-1',
    userId: 'user-1',
    pageViews: 5,
    timeSpent: 120,
    bounceRate: 0.3,
    conversionRate: 0.1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<IAuthRepository> = {}): jest.Mocked<IAuthRepository> {
  return {
    findSessionAnalyticsBySessionId: jest.fn().mockResolvedValue(null),
    createSessionAnalytics: jest.fn().mockResolvedValue(makeAnalytics()),
    ...overrides,
  } as any;
}

describe('CreateUserSessionAnalyticsUseCase', () => {
  it('creates analytics for a new session', async () => {
    const repo = makeRepo();
    const uc = new CreateUserSessionAnalyticsUseCase(repo, makeLogger());
    const result = await uc.execute({ sessionId: 'session-1', userId: 'user-1' });
    expect(result.analytics.sessionId).toBe('session-1');
    expect(repo.createSessionAnalytics).toHaveBeenCalledTimes(1);
  });

  it('returns existing analytics when session already has analytics', async () => {
    const existing = makeAnalytics();
    const repo = makeRepo({ findSessionAnalyticsBySessionId: jest.fn().mockResolvedValue(existing) });
    const uc = new CreateUserSessionAnalyticsUseCase(repo, makeLogger());
    const result = await uc.execute({ sessionId: 'session-1', userId: 'user-1' });
    expect(result.analytics.id).toBe(existing.id);
    expect(repo.createSessionAnalytics).not.toHaveBeenCalled();
  });

  it('throws ValidationError when sessionId is missing', async () => {
    const repo = makeRepo();
    const uc = new CreateUserSessionAnalyticsUseCase(repo, makeLogger());
    await expect(uc.execute({ sessionId: '', userId: 'user-1' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when userId is missing', async () => {
    const repo = makeRepo();
    const uc = new CreateUserSessionAnalyticsUseCase(repo, makeLogger());
    await expect(uc.execute({ sessionId: 'session-1', userId: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when bounceRate is out of range', async () => {
    const repo = makeRepo();
    const uc = new CreateUserSessionAnalyticsUseCase(repo, makeLogger());
    await expect(
      uc.execute({ sessionId: 'session-1', userId: 'user-1', bounceRate: 1.5 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when pageViews is negative', async () => {
    const repo = makeRepo();
    const uc = new CreateUserSessionAnalyticsUseCase(repo, makeLogger());
    await expect(
      uc.execute({ sessionId: 'session-1', userId: 'user-1', pageViews: -1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
