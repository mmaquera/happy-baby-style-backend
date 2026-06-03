jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    }),
  },
}), { virtual: true });

import { GetUserAppEventsUseCase } from '../GetUserAppEventsUseCase';
import { GetProductAppEventsUseCase } from '../GetProductAppEventsUseCase';
import type { IAppEventRepository } from '../../../../domain/repositories/IAppEventRepository';
import type { AppEvent } from '../../../../domain/entities/Analytics';
import { ValidationError } from '../../../../domain/errors/DomainError';

const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const PRODUCT_ID = 'pppppppp-qqqq-rrrr-ssss-tttttttttttt';

function makeEvent(overrides: Partial<AppEvent> = {}): AppEvent {
  return {
    id: 'event-id-1',
    userId: USER_ID,
    eventType: 'product_view',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeRepo(
  overrides: Partial<jest.Mocked<IAppEventRepository>> = {},
): jest.Mocked<IAppEventRepository> {
  return {
    findByUserId: jest.fn().mockResolvedValue([makeEvent()]),
    findByProductId: jest.fn().mockResolvedValue([makeEvent({ productId: PRODUCT_ID })]),
    findByUserIdAndType: jest.fn().mockResolvedValue([makeEvent()]),
    create: jest.fn().mockResolvedValue(makeEvent()),
    ...overrides,
  };
}

// ── GetUserAppEventsUseCase ───────────────────────────────────────────────────

describe('GetUserAppEventsUseCase', () => {
  it('returns events for a valid userId with default limit', async () => {
    const repo = makeRepo();
    const uc = new GetUserAppEventsUseCase(repo);
    const result = await uc.execute({ userId: USER_ID });
    expect(result).toHaveLength(1);
    expect(repo.findByUserId).toHaveBeenCalledWith(USER_ID, 100);
  });

  it('respects an explicit limit', async () => {
    const repo = makeRepo();
    const uc = new GetUserAppEventsUseCase(repo);
    await uc.execute({ userId: USER_ID, limit: 50 });
    expect(repo.findByUserId).toHaveBeenCalledWith(USER_ID, 50);
  });

  it('throws ValidationError when userId is empty', async () => {
    const repo = makeRepo();
    const uc = new GetUserAppEventsUseCase(repo);
    await expect(uc.execute({ userId: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when limit is 0', async () => {
    const repo = makeRepo();
    const uc = new GetUserAppEventsUseCase(repo);
    await expect(uc.execute({ userId: USER_ID, limit: 0 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when limit exceeds maximum', async () => {
    const repo = makeRepo();
    const uc = new GetUserAppEventsUseCase(repo);
    await expect(uc.execute({ userId: USER_ID, limit: 9999 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns empty array when repository returns no events', async () => {
    const repo = makeRepo({ findByUserId: jest.fn().mockResolvedValue([]) });
    const uc = new GetUserAppEventsUseCase(repo);
    const result = await uc.execute({ userId: USER_ID });
    expect(result).toHaveLength(0);
  });
});

// ── GetProductAppEventsUseCase ────────────────────────────────────────────────

describe('GetProductAppEventsUseCase', () => {
  it('returns events for a valid productId with default limit', async () => {
    const repo = makeRepo();
    const uc = new GetProductAppEventsUseCase(repo);
    const result = await uc.execute({ productId: PRODUCT_ID });
    expect(result).toHaveLength(1);
    expect(repo.findByProductId).toHaveBeenCalledWith(PRODUCT_ID, 100);
  });

  it('respects an explicit limit', async () => {
    const repo = makeRepo();
    const uc = new GetProductAppEventsUseCase(repo);
    await uc.execute({ productId: PRODUCT_ID, limit: 25 });
    expect(repo.findByProductId).toHaveBeenCalledWith(PRODUCT_ID, 25);
  });

  it('throws ValidationError when productId is empty', async () => {
    const repo = makeRepo();
    const uc = new GetProductAppEventsUseCase(repo);
    await expect(uc.execute({ productId: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when limit exceeds maximum', async () => {
    const repo = makeRepo();
    const uc = new GetProductAppEventsUseCase(repo);
    await expect(
      uc.execute({ productId: PRODUCT_ID, limit: 9999 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns empty array when repository returns no events', async () => {
    const repo = makeRepo({ findByProductId: jest.fn().mockResolvedValue([]) });
    const uc = new GetProductAppEventsUseCase(repo);
    const result = await uc.execute({ productId: PRODUCT_ID });
    expect(result).toHaveLength(0);
  });
});
