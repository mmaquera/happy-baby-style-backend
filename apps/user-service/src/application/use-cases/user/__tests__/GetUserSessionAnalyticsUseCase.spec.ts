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

import { GetUserSessionAnalyticsUseCase } from '../GetUserSessionAnalyticsUseCase';
import type { IAuthRepository } from '../../../../domain/repositories/IAuthRepository';
import type { ILogger } from '@hbs/logging';
import type { UserSessionAnalytics } from '../../../../domain/entities/Auth';
import { ValidationError } from '../../../../domain/errors/DomainError';

function makeLogger(): ILogger {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
}

function makeAnalytics(id = 'a-1'): UserSessionAnalytics {
  return {
    id,
    sessionId: 'session-1',
    userId: 'user-1',
    pageViews: 3,
    timeSpent: 60,
    bounceRate: 0.2,
    conversionRate: 0.05,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeRepo(overrides: Partial<IAuthRepository> = {}): jest.Mocked<IAuthRepository> {
  return {
    findSessionAnalyticsByUserId: jest.fn().mockResolvedValue([makeAnalytics(), makeAnalytics('a-2')]),
    findSessionAnalyticsBySessionId: jest.fn().mockResolvedValue(makeAnalytics()),
    ...overrides,
  } as any;
}

describe('GetUserSessionAnalyticsUseCase', () => {
  it('returns paginated analytics for a user', async () => {
    const repo = makeRepo();
    const uc = new GetUserSessionAnalyticsUseCase(repo, makeLogger());
    const result = await uc.execute({ userId: 'user-1' });
    expect(result.total).toBe(2);
    expect(result.analytics).toHaveLength(2);
    expect(result.pagination.limit).toBe(20);
  });

  it('filters by sessionId when provided', async () => {
    const repo = makeRepo();
    const uc = new GetUserSessionAnalyticsUseCase(repo, makeLogger());
    const result = await uc.execute({ userId: 'user-1', sessionId: 'session-1' });
    expect(repo.findSessionAnalyticsBySessionId).toHaveBeenCalledWith('session-1');
    expect(result.analytics).toHaveLength(1);
  });

  it('returns empty list when specific session has no analytics', async () => {
    const repo = makeRepo({ findSessionAnalyticsBySessionId: jest.fn().mockResolvedValue(null) });
    const uc = new GetUserSessionAnalyticsUseCase(repo, makeLogger());
    const result = await uc.execute({ userId: 'user-1', sessionId: 'missing-session' });
    expect(result.analytics).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('throws ValidationError when userId is missing', async () => {
    const repo = makeRepo();
    const uc = new GetUserSessionAnalyticsUseCase(repo, makeLogger());
    await expect(uc.execute({ userId: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when limit is out of range', async () => {
    const repo = makeRepo();
    const uc = new GetUserSessionAnalyticsUseCase(repo, makeLogger());
    await expect(uc.execute({ userId: 'user-1', limit: 200 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('applies pagination correctly', async () => {
    const repo = makeRepo();
    const uc = new GetUserSessionAnalyticsUseCase(repo, makeLogger());
    const result = await uc.execute({ userId: 'user-1', limit: 1, offset: 0 });
    expect(result.analytics).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });
});
