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

import { ListSavedPaymentMethodsUseCase } from '../ListSavedPaymentMethodsUseCase';
import { CreateSavedPaymentMethodUseCase } from '../CreateSavedPaymentMethodUseCase';
import { UpdateSavedPaymentMethodUseCase } from '../UpdateSavedPaymentMethodUseCase';
import { DeleteSavedPaymentMethodUseCase } from '../DeleteSavedPaymentMethodUseCase';
import type { ISavedPaymentMethodRepository } from '../../../../domain/repositories/ISavedPaymentMethodRepository';
import type { SavedPaymentMethod } from '../../../../domain/entities/Payment';
import { ValidationError, NotFoundError, ForbiddenError } from '../../../../domain/errors/DomainError';

const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const METHOD_ID = 'ffffffff-0000-1111-2222-333333333333';
const ADMIN_ID = '11111111-2222-3333-4444-555555555555';

function makeMethod(overrides: Partial<SavedPaymentMethod> = {}): SavedPaymentMethod {
  return {
    id: METHOD_ID,
    userId: USER_ID,
    type: 'credit_card',
    provider: 'Visa',
    lastFour: '4242',
    expiryMonth: 12,
    expiryYear: 2027,
    cardholderName: 'Jane Doe',
    isDefault: false,
    isActive: true,
    metadata: {},
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeRepo(
  overrides: Partial<jest.Mocked<ISavedPaymentMethodRepository>> = {},
): jest.Mocked<ISavedPaymentMethodRepository> {
  return {
    findByUserId: jest.fn().mockResolvedValue([makeMethod()]),
    findById: jest.fn().mockResolvedValue(makeMethod()),
    findDefaultByUserId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(makeMethod()),
    update: jest.fn().mockResolvedValue(makeMethod()),
    deactivate: jest.fn().mockResolvedValue(makeMethod({ isActive: false })),
    setDefault: jest.fn().mockResolvedValue(makeMethod({ isDefault: true })),
    ...overrides,
  };
}

// ── ListSavedPaymentMethodsUseCase ────────────────────────────────────────────

describe('ListSavedPaymentMethodsUseCase', () => {
  it('returns active methods for a valid userId', async () => {
    const repo = makeRepo();
    const uc = new ListSavedPaymentMethodsUseCase(repo);
    const result = await uc.execute({ userId: USER_ID });
    expect(result).toHaveLength(1);
    expect(repo.findByUserId).toHaveBeenCalledWith(USER_ID, false);
  });

  it('passes includeInactive flag to repository', async () => {
    const repo = makeRepo();
    const uc = new ListSavedPaymentMethodsUseCase(repo);
    await uc.execute({ userId: USER_ID, includeInactive: true });
    expect(repo.findByUserId).toHaveBeenCalledWith(USER_ID, true);
  });

  it('throws ValidationError when userId is empty', async () => {
    const repo = makeRepo();
    const uc = new ListSavedPaymentMethodsUseCase(repo);
    await expect(uc.execute({ userId: '' })).rejects.toBeInstanceOf(ValidationError);
  });
});

// ── CreateSavedPaymentMethodUseCase ──────────────────────────────────────────

describe('CreateSavedPaymentMethodUseCase', () => {
  it('creates a payment method successfully', async () => {
    const repo = makeRepo();
    const uc = new CreateSavedPaymentMethodUseCase(repo);
    const result = await uc.execute({
      userId: USER_ID,
      type: 'credit_card',
      provider: 'Visa',
    });
    expect(result.id).toBe(METHOD_ID);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('throws ValidationError when userId is missing', async () => {
    const repo = makeRepo();
    const uc = new CreateSavedPaymentMethodUseCase(repo);
    await expect(
      uc.execute({ userId: '', type: 'credit_card', provider: 'Visa' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for invalid payment type', async () => {
    const repo = makeRepo();
    const uc = new CreateSavedPaymentMethodUseCase(repo);
    await expect(
      uc.execute({ userId: USER_ID, type: 'bitcoin' as any, provider: 'BTC' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when provider is missing', async () => {
    const repo = makeRepo();
    const uc = new CreateSavedPaymentMethodUseCase(repo);
    await expect(
      uc.execute({ userId: USER_ID, type: 'credit_card', provider: '' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ── UpdateSavedPaymentMethodUseCase ──────────────────────────────────────────

describe('UpdateSavedPaymentMethodUseCase', () => {
  it('updates method when caller is the owner', async () => {
    const repo = makeRepo();
    const uc = new UpdateSavedPaymentMethodUseCase(repo);
    const result = await uc.execute({
      id: METHOD_ID,
      requestingUserId: USER_ID,
      isAdmin: false,
      data: { isDefault: true },
    });
    expect(result).toBeDefined();
    expect(repo.update).toHaveBeenCalledWith(METHOD_ID, { isDefault: true });
  });

  it('allows admin to update a method they do not own', async () => {
    const repo = makeRepo();
    const uc = new UpdateSavedPaymentMethodUseCase(repo);
    await expect(
      uc.execute({
        id: METHOD_ID,
        requestingUserId: ADMIN_ID,
        isAdmin: true,
        data: { isDefault: false },
      }),
    ).resolves.toBeDefined();
  });

  it('throws NotFoundError (ambiguous) when non-owner tries to update', async () => {
    const repo = makeRepo();
    const uc = new UpdateSavedPaymentMethodUseCase(repo);
    await expect(
      uc.execute({
        id: METHOD_ID,
        requestingUserId: 'other-user-id',
        isAdmin: false,
        data: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when method does not exist', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new UpdateSavedPaymentMethodUseCase(repo);
    await expect(
      uc.execute({
        id: METHOD_ID,
        requestingUserId: USER_ID,
        isAdmin: false,
        data: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ForbiddenError when non-admin tries to update a deactivated method', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(makeMethod({ isActive: false })),
    });
    const uc = new UpdateSavedPaymentMethodUseCase(repo);
    await expect(
      uc.execute({
        id: METHOD_ID,
        requestingUserId: USER_ID,
        isAdmin: false,
        data: {},
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws ValidationError when id is empty', async () => {
    const repo = makeRepo();
    const uc = new UpdateSavedPaymentMethodUseCase(repo);
    await expect(
      uc.execute({ id: '', requestingUserId: USER_ID, isAdmin: false, data: {} }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ── DeleteSavedPaymentMethodUseCase ──────────────────────────────────────────

describe('DeleteSavedPaymentMethodUseCase', () => {
  it('deactivates method when caller is the owner', async () => {
    const repo = makeRepo();
    const uc = new DeleteSavedPaymentMethodUseCase(repo);
    const result = await uc.execute({
      id: METHOD_ID,
      requestingUserId: USER_ID,
      isAdmin: false,
    });
    expect(result.isActive).toBe(false);
    expect(repo.deactivate).toHaveBeenCalledWith(METHOD_ID);
  });

  it('allows admin to deactivate a method they do not own', async () => {
    const repo = makeRepo();
    const uc = new DeleteSavedPaymentMethodUseCase(repo);
    await expect(
      uc.execute({ id: METHOD_ID, requestingUserId: ADMIN_ID, isAdmin: true }),
    ).resolves.toBeDefined();
  });

  it('throws NotFoundError (ambiguous) when non-owner tries to delete', async () => {
    const repo = makeRepo();
    const uc = new DeleteSavedPaymentMethodUseCase(repo);
    await expect(
      uc.execute({ id: METHOD_ID, requestingUserId: 'other-user-id', isAdmin: false }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when method does not exist', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new DeleteSavedPaymentMethodUseCase(repo);
    await expect(
      uc.execute({ id: METHOD_ID, requestingUserId: USER_ID, isAdmin: false }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError when id is empty', async () => {
    const repo = makeRepo();
    const uc = new DeleteSavedPaymentMethodUseCase(repo);
    await expect(
      uc.execute({ id: '', requestingUserId: USER_ID, isAdmin: false }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
