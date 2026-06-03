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
    },
  }),
  { virtual: true },
);

import { CreatePaymentMethodUseCase } from '../CreatePaymentMethodUseCase';
import { UpdatePaymentMethodUseCase } from '../UpdatePaymentMethodUseCase';
import { DeletePaymentMethodUseCase } from '../DeletePaymentMethodUseCase';
import type {
  IPaymentMethodRepository,
  PaymentMethodData,
  CreatePaymentMethodInput,
  UpdatePaymentMethodInput,
} from '../../../domain/repositories/IPaymentMethodRepository';
import { NotFoundError } from '@hbs/shared-kernel';
import { Permission } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makePaymentMethod(overrides: Partial<PaymentMethodData> = {}): PaymentMethodData {
  return {
    id: 'pm-1',
    orderId: 'ord-1',
    type: 'credit_card',
    amount: 59.98,
    status: 'pending',
    transactionId: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<CreatePaymentMethodInput> = {}): CreatePaymentMethodInput {
  return {
    orderId: 'ord-1',
    type: 'credit_card',
    amount: 59.98,
    status: 'pending',
    ...overrides,
  };
}

function makeUpdateInput(overrides: Partial<UpdatePaymentMethodInput> = {}): UpdatePaymentMethodInput {
  return { status: 'completed', ...overrides };
}

function makeUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-1',
    email: 'owner@test.com',
    permissions: [Permission.UPDATE_ORDER],
    groups: ['sales-manager'],
    ...overrides,
  };
}

function makeRepo(
  overrides: Partial<jest.Mocked<IPaymentMethodRepository>> = {},
): jest.Mocked<IPaymentMethodRepository> {
  return {
    create: jest.fn().mockResolvedValue(makePaymentMethod()),
    findById: jest.fn().mockResolvedValue(makePaymentMethod()),
    update: jest.fn().mockResolvedValue(makePaymentMethod({ status: 'completed' })),
    delete: jest.fn().mockResolvedValue(true),
    assertOrderWriteAccess: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<IPaymentMethodRepository>;
}

// ---------------------------------------------------------------------------
// CreatePaymentMethodUseCase
// ---------------------------------------------------------------------------

describe('CreatePaymentMethodUseCase', () => {
  it('asserts write access on the parent Order before creating', async () => {
    const repo = makeRepo();
    const uc = new CreatePaymentMethodUseCase(repo);

    await uc.execute(makeCreateInput(), makeUser());

    expect(repo.assertOrderWriteAccess).toHaveBeenCalledWith('ord-1', 'write', makeUser());
    expect(repo.create).toHaveBeenCalledWith(makeCreateInput());
  });

  it('returns the created PaymentMethod on success', async () => {
    const uc = new CreatePaymentMethodUseCase(makeRepo());
    const result = await uc.execute(makeCreateInput(), makeUser());
    expect(result.id).toBe('pm-1');
    expect(result.orderId).toBe('ord-1');
  });

  it('throws NotFoundError when the parent Order is access-denied (order not writable)', async () => {
    const repo = makeRepo({
      assertOrderWriteAccess: jest.fn().mockRejectedValue(new NotFoundError('Order', 'ord-99')),
    });
    const uc = new CreatePaymentMethodUseCase(repo);

    await expect(
      uc.execute(makeCreateInput({ orderId: 'ord-99' }), makeUser()),
    ).rejects.toBeInstanceOf(NotFoundError);

    // create() must NOT be called when the access guard throws.
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('propagates unexpected errors from assertOrderWriteAccess', async () => {
    const repo = makeRepo({
      assertOrderWriteAccess: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
    });
    const uc = new CreatePaymentMethodUseCase(repo);

    await expect(uc.execute(makeCreateInput(), makeUser())).rejects.toThrow('Redis unavailable');
    expect(repo.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// UpdatePaymentMethodUseCase
// ---------------------------------------------------------------------------

describe('UpdatePaymentMethodUseCase', () => {
  it('loads the PaymentMethod, asserts write access, then updates', async () => {
    const repo = makeRepo();
    const uc = new UpdatePaymentMethodUseCase(repo);

    const result = await uc.execute('pm-1', makeUpdateInput(), makeUser());

    expect(repo.findById).toHaveBeenCalledWith('pm-1');
    expect(repo.assertOrderWriteAccess).toHaveBeenCalledWith('ord-1', 'write', makeUser());
    expect(repo.update).toHaveBeenCalledWith('pm-1', makeUpdateInput());
    expect(result.status).toBe('completed');
  });

  it('throws NotFoundError when PaymentMethod does not exist', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new UpdatePaymentMethodUseCase(repo);

    await expect(uc.execute('pm-x', makeUpdateInput(), makeUser())).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(repo.assertOrderWriteAccess).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the parent Order is not writable (BOLA denial)', async () => {
    const repo = makeRepo({
      assertOrderWriteAccess: jest.fn().mockRejectedValue(new NotFoundError('Order', 'ord-1')),
    });
    const uc = new UpdatePaymentMethodUseCase(repo);

    await expect(uc.execute('pm-1', makeUpdateInput(), makeUser())).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DeletePaymentMethodUseCase
// ---------------------------------------------------------------------------

describe('DeletePaymentMethodUseCase', () => {
  it('loads the PaymentMethod, asserts unlink access, then deletes — returns ambiguous SuccessResponse (M-2)', async () => {
    const repo = makeRepo();
    const uc = new DeletePaymentMethodUseCase(repo);

    const result = await uc.execute('pm-1', makeUser());

    expect(repo.findById).toHaveBeenCalledWith('pm-1');
    expect(repo.assertOrderWriteAccess).toHaveBeenCalledWith('ord-1', 'unlink', makeUser());
    expect(repo.delete).toHaveBeenCalledWith('pm-1');
    // M-2 anti-enumeration: always returns the same SuccessResponse.
    expect(result).toEqual({ success: true, message: 'Operation completed' });
  });

  it('returns ambiguous SuccessResponse when PaymentMethod does not exist (M-2: no existence confirmation)', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new DeletePaymentMethodUseCase(repo);

    const result = await uc.execute('pm-x', makeUser());

    // M-2: never reveals whether record existed.
    expect(result).toEqual({ success: true, message: 'Operation completed' });
    expect(repo.assertOrderWriteAccess).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('rethrows NotFoundError from assertOrderWriteAccess (BOLA denial — caller is not owner)', async () => {
    const repo = makeRepo({
      assertOrderWriteAccess: jest.fn().mockRejectedValue(new NotFoundError('Order', 'ord-1')),
    });
    const uc = new DeletePaymentMethodUseCase(repo);

    await expect(uc.execute('pm-1', makeUser())).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
