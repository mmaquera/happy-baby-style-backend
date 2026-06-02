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

import { UpdateOrderUseCase } from '../UpdateOrderUseCase';
import type { IOrderRepository } from '../../../domain/repositories/IOrderRepository';
import type { Order, UpdateOrderRequest } from '../../../domain/entities/Order';
import { NotFoundError, ValidationError, BusinessLogicError } from '@hbs/shared-kernel';
import { Permission } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    userId: 'user-1',
    orderNumber: 'ORD-001',
    customerEmail: 'owner@test.com',
    customerName: 'Test User',
    status: 'pending',
    subtotal: 100,
    taxAmount: 0,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: 100,
    currency: 'PEN',
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    ...overrides,
  };
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

function makeUpdateRequest(overrides: Partial<UpdateOrderRequest> = {}): UpdateOrderRequest {
  return { status: 'confirmed', ...overrides };
}

/**
 * Builds a minimal Mocked<IOrderRepository>.
 * findByIdUnrestricted returns makeOrder() by default (pre-fetch for write path).
 * update returns makeOrder() with the updated status by default.
 * ensureWritable resolves successfully by default (gate passes).
 */
function makeRepo(
  overrides: Partial<jest.Mocked<IOrderRepository>> = {},
): jest.Mocked<IOrderRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(makeOrder()),
    findByIdUnrestricted: jest.fn().mockResolvedValue(makeOrder()),
    findAll: jest.fn(),
    update: jest.fn().mockResolvedValue(makeOrder({ status: 'confirmed' })),
    delete: jest.fn(),
    findByStatus: jest.fn(),
    findByCustomerEmail: jest.fn(),
    updateStatus: jest.fn(),
    addOrderItem: jest.fn(),
    removeOrderItem: jest.fn(),
    getOrderItems: jest.fn(),
    createShippingAddress: jest.fn(),
    getShippingAddress: jest.fn(),
    getOrderStats: jest.fn(),
    getOrdersByDateRange: jest.fn(),
    ensureWritable: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<IOrderRepository>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UpdateOrderUseCase', () => {
  // ── Validation ─────────────────────────────────────────────────────────────

  it('throws ValidationError when id is empty string', async () => {
    const uc = new UpdateOrderUseCase(makeRepo());
    const err = await uc.execute('', makeUpdateRequest(), makeUser()).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('Order ID is required');
  });

  // ── Not found (plain DB miss) ───────────────────────────────────────────────

  it('throws NotFoundError when findByIdUnrestricted returns null (TOCTOU race)', async () => {
    // ensureWritable passes, but the order is deleted concurrently before findByIdUnrestricted.
    // Must throw typed NotFoundError (not plain Error) so mapDomainError produces 404, not 500.
    const repo = makeRepo({ findByIdUnrestricted: jest.fn().mockResolvedValue(null) });
    const uc = new UpdateOrderUseCase(repo);
    const err = await uc.execute('ord-x', makeUpdateRequest(), makeUser()).catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('uses findByIdUnrestricted for pre-fetch and forwards currentUser to update', async () => {
    // The pre-fetch MUST use findByIdUnrestricted so that read-mode record rules do NOT
    // filter out orders that management users are allowed to mutate. Write-mode rules
    // are enforced separately inside repo.update via assertWriteAccess.
    const user = makeUser();
    const repo = makeRepo();
    const uc = new UpdateOrderUseCase(repo);

    const result = await uc.execute('ord-1', makeUpdateRequest(), user);

    expect(repo.findByIdUnrestricted).toHaveBeenCalledWith('ord-1');
    expect(repo.update).toHaveBeenCalledWith('ord-1', expect.any(Object), user);
    expect(result.status).toBe('confirmed');
  });

  it('null currentUser is forwarded to repo.update (internal caller path)', async () => {
    const repo = makeRepo();
    const uc = new UpdateOrderUseCase(repo);

    await uc.execute('ord-1', makeUpdateRequest(), null);

    expect(repo.findByIdUnrestricted).toHaveBeenCalledWith('ord-1');
    expect(repo.update).toHaveBeenCalledWith('ord-1', expect.any(Object), null);
  });

  // ── Status transition validation ────────────────────────────────────────────

  it('throws BusinessLogicError on invalid status transition (pending → delivered)', async () => {
    const repo = makeRepo({
      findByIdUnrestricted: jest.fn().mockResolvedValue(makeOrder({ status: 'pending' })),
    });
    const uc = new UpdateOrderUseCase(repo);
    const err = await uc.execute('ord-1', { status: 'delivered' as any }, makeUser()).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect(err.message).toContain('Invalid status transition');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('allows valid status transition (pending → confirmed)', async () => {
    const repo = makeRepo({
      findByIdUnrestricted: jest.fn().mockResolvedValue(makeOrder({ status: 'pending' })),
      update: jest.fn().mockResolvedValue(makeOrder({ status: 'confirmed' })),
    });
    const uc = new UpdateOrderUseCase(repo);
    const result = await uc.execute('ord-1', { status: 'confirmed' as any }, makeUser());
    expect(result.status).toBe('confirmed');
  });

  // ── Record rule denial (BOLA closure) ───────────────────────────────────────

  it('propagates NotFoundError when repo.update throws it (write rule denied access)', async () => {
    // Simulates: findByIdUnrestricted succeeds (order exists), but repo.update
    // internally runs assertWriteAccess (write mode) and throws NotFoundError because a
    // write record rule hides this order from the requesting user.
    const denyError = new NotFoundError('Order', 'ord-1');
    const repo = makeRepo({
      update: jest.fn().mockRejectedValue(denyError),
    });
    const uc = new UpdateOrderUseCase(repo);

    const err = await uc.execute('ord-1', makeUpdateRequest(), makeUser()).catch((e) => e);

    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.message).toContain('Order');
  });

  // ── Write-gate-first (security hardening) ─────────────────────────────────

  it('ensureWritable is called BEFORE findByIdUnrestricted (write-gate-first)', async () => {
    // Verifies the ordering invariant: ensureWritable must run first so that
    // no business-logic error (status transition, not-found from pre-fetch) can
    // leak order existence or state to an unauthorized caller.
    const callOrder: string[] = [];
    const repo = makeRepo({
      ensureWritable: jest.fn().mockImplementation(async () => { callOrder.push('ensureWritable'); }),
      findByIdUnrestricted: jest.fn().mockImplementation(async () => {
        callOrder.push('findByIdUnrestricted');
        return makeOrder();
      }),
      update: jest.fn().mockResolvedValue(makeOrder({ status: 'confirmed' })),
    });
    const uc = new UpdateOrderUseCase(repo);

    await uc.execute('ord-1', makeUpdateRequest(), makeUser());

    expect(callOrder[0]).toBe('ensureWritable');
    expect(callOrder[1]).toBe('findByIdUnrestricted');
  });

  it('foreign order (denied by write gate) → NotFoundError, NOT a status-transition error', async () => {
    // Simulates: the requesting user does not own / has no write access to ord-foreign.
    // ensureWritable throws NotFoundError (ambiguous 404) before any prefetch runs.
    // Business logic (status transition) NEVER executes — no info is leaked.
    const denyError = new NotFoundError('Order', 'ord-foreign');
    const repo = makeRepo({
      ensureWritable: jest.fn().mockRejectedValue(denyError),
      findByIdUnrestricted: jest.fn(), // must NOT be called
    });
    const uc = new UpdateOrderUseCase(repo);

    const err = await uc.execute('ord-foreign', makeUpdateRequest(), makeUser()).catch((e) => e);

    expect(err).toBeInstanceOf(NotFoundError);
    // The prefetch and status-validation must never have run.
    expect(repo.findByIdUnrestricted).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('read-mode record rules do NOT affect write pre-fetch (findByIdUnrestricted bypasses them)', async () => {
    // This test documents the invariant: even if a read rule would hide this order from
    // the user, findByIdUnrestricted still finds it, so the update proceeds to the write
    // guard. The write guard (assertWriteAccess, 'write' mode) is the authoritative check.
    const repo = makeRepo({
      // findByIdUnrestricted always returns the order regardless of user read rules.
      findByIdUnrestricted: jest.fn().mockResolvedValue(makeOrder()),
      update: jest.fn().mockResolvedValue(makeOrder({ status: 'confirmed' })),
    });
    const uc = new UpdateOrderUseCase(repo);

    const result = await uc.execute('ord-1', makeUpdateRequest(), makeUser());

    expect(repo.findByIdUnrestricted).toHaveBeenCalledWith('ord-1');
    expect(result.status).toBe('confirmed');
  });
});
