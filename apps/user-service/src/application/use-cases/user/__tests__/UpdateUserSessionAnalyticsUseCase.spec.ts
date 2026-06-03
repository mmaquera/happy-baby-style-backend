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

import { UpdateUserSessionAnalyticsUseCase } from '../UpdateUserSessionAnalyticsUseCase';
import type { IAuthRepository } from '../../../../domain/repositories/IAuthRepository';
import type { ILogger } from '@hbs/logging';
import type { UserSessionAnalytics } from '../../../../domain/entities/Auth';
import { ValidationError, NotFoundError } from '../../../../domain/errors/DomainError';

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
    findSessionAnalyticsById: jest.fn().mockResolvedValue(makeAnalytics()),
    updateSessionAnalytics: jest.fn().mockResolvedValue(makeAnalytics({ pageViews: 10 })),
    ...overrides,
  } as any;
}

describe('UpdateUserSessionAnalyticsUseCase', () => {
  it('updates analytics and returns changes', async () => {
    const repo = makeRepo();
    const uc = new UpdateUserSessionAnalyticsUseCase(repo, makeLogger());
    const result = await uc.execute('analytics-1', { pageViews: 10 });
    expect(result.analytics).toBeDefined();
    expect(repo.updateSessionAnalytics).toHaveBeenCalledWith('analytics-1', { pageViews: 10 });
  });

  it('throws NotFoundError when analytics do not exist', async () => {
    const repo = makeRepo({ findSessionAnalyticsById: jest.fn().mockResolvedValue(null) });
    const uc = new UpdateUserSessionAnalyticsUseCase(repo, makeLogger());
    await expect(uc.execute('analytics-1', { pageViews: 5 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError when id is empty', async () => {
    const repo = makeRepo();
    const uc = new UpdateUserSessionAnalyticsUseCase(repo, makeLogger());
    await expect(uc.execute('', { pageViews: 5 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when bounceRate is out of range', async () => {
    const repo = makeRepo();
    const uc = new UpdateUserSessionAnalyticsUseCase(repo, makeLogger());
    await expect(uc.execute('analytics-1', { bounceRate: 2 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('tracks changes correctly', async () => {
    const repo = makeRepo({
      updateSessionAnalytics: jest.fn().mockResolvedValue(makeAnalytics({ pageViews: 10 })),
    });
    const uc = new UpdateUserSessionAnalyticsUseCase(repo, makeLogger());
    const result = await uc.execute('analytics-1', { pageViews: 10 });
    expect(result.changes).toContain('pageViews: 5 → 10');
  });
});
