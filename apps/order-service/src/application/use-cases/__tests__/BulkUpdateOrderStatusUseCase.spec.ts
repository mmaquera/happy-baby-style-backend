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

import {
  BulkUpdateOrderStatusUseCase,
  BULK_UPDATE_MAX_ORDERS,
} from '../BulkUpdateOrderStatusUseCase';
import { UpdateOrderUseCase } from '../UpdateOrderUseCase';
import type { Order } from '../../../domain/entities/Order';
import { ValidationError, NotFoundError } from '@hbs/shared-kernel';
import { Permission } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    userId: 'user-1',
    orderNumber: 'ORD-2026-000001',
    customerEmail: 'owner@test.com',
    customerName: 'Test User',
    status: 'confirmed',
    paymentStatus: 'pending',
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
    email: 'manager@test.com',
    permissions: [Permission.UPDATE_ORDER],
    groups: ['sales-manager'],
    ...overrides,
  };
}

/**
 * Returns a jest-mocked UpdateOrderUseCase with execute resolving makeOrder() by default.
 * BulkUpdateOrderStatusUseCase delegates to UpdateOrderUseCase per item so that
 * write-gate-first + status-transition validation are preserved for each order.
 */
function makeUpdateOrderUseCase(
  overrides: Partial<jest.Mocked<UpdateOrderUseCase>> = {},
): jest.Mocked<UpdateOrderUseCase> {
  return {
    execute: jest.fn().mockResolvedValue(makeOrder()),
    ...overrides,
  } as unknown as jest.Mocked<UpdateOrderUseCase>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BulkUpdateOrderStatusUseCase', () => {
  // ── Array size guard ───────────────────────────────────────────────────────

  it('throws ValidationError when array length exceeds the maximum (DoS guard)', async () => {
    const uc = new BulkUpdateOrderStatusUseCase(makeUpdateOrderUseCase());

    const tooManyIds = Array.from({ length: BULK_UPDATE_MAX_ORDERS + 1 }, (_, i) => `ord-${i}`);

    const err = await uc.execute(tooManyIds, 'confirmed', makeUser()).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain(`${BULK_UPDATE_MAX_ORDERS}`);
    // Nothing should have been processed.
    expect(makeUpdateOrderUseCase().execute).not.toHaveBeenCalled();
  });

  it('accepts exactly the maximum number of orders without throwing', async () => {
    const updateUseCase = makeUpdateOrderUseCase();
    const uc = new BulkUpdateOrderStatusUseCase(updateUseCase);

    const ids = Array.from({ length: BULK_UPDATE_MAX_ORDERS }, (_, i) => `ord-${i}`);
    await expect(uc.execute(ids, 'confirmed', makeUser())).resolves.not.toThrow();
    expect(updateUseCase.execute).toHaveBeenCalledTimes(BULK_UPDATE_MAX_ORDERS);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('returns all updated orders when all updates succeed', async () => {
    const ordA = makeOrder({ id: 'ord-A', status: 'confirmed' });
    const ordB = makeOrder({ id: 'ord-B', status: 'confirmed' });
    const updateUseCase = makeUpdateOrderUseCase({
      execute: jest
        .fn()
        .mockResolvedValueOnce(ordA)
        .mockResolvedValueOnce(ordB),
    });
    const uc = new BulkUpdateOrderStatusUseCase(updateUseCase);

    const result = await uc.execute(['ord-A', 'ord-B'], 'confirmed', makeUser());

    expect(result).toHaveLength(2);
    expect(result.map((o) => o.id)).toEqual(expect.arrayContaining(['ord-A', 'ord-B']));
  });

  // ── Partial-failure (allSettled) ───────────────────────────────────────────

  it('returns only successful orders when one ID is denied (record-rule / not-found)', async () => {
    // Simulates: ord-A updates ok; ord-B is denied by a write record rule (NotFoundError).
    // The batch must not be aborted — ord-A must be returned; ord-B omitted.
    const ordA = makeOrder({ id: 'ord-A', status: 'confirmed' });
    const updateUseCase = makeUpdateOrderUseCase({
      execute: jest
        .fn()
        .mockResolvedValueOnce(ordA)
        .mockRejectedValueOnce(new NotFoundError('Order', 'ord-B')),
    });
    const uc = new BulkUpdateOrderStatusUseCase(updateUseCase);

    const result = await uc.execute(['ord-A', 'ord-B'], 'confirmed', makeUser());

    // Only the successful order is returned.
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ord-A');
  });

  it('returns empty array when ALL orders are denied', async () => {
    const updateUseCase = makeUpdateOrderUseCase({
      execute: jest.fn().mockRejectedValue(new NotFoundError('Order', 'ord-X')),
    });
    const uc = new BulkUpdateOrderStatusUseCase(updateUseCase);

    const result = await uc.execute(['ord-X', 'ord-Y'], 'confirmed', makeUser());

    expect(result).toHaveLength(0);
  });

  // ── Security: no ID leakage via response ──────────────────────────────────

  it('does NOT include denied IDs in the returned array (ambiguity-404 preserved)', async () => {
    // Even if ord-B fails, its ID must not appear anywhere in the return value.
    const ordA = makeOrder({ id: 'ord-A', status: 'confirmed' });
    const updateUseCase = makeUpdateOrderUseCase({
      execute: jest
        .fn()
        .mockResolvedValueOnce(ordA)
        .mockRejectedValueOnce(new NotFoundError('Order', 'ord-B')),
    });
    const uc = new BulkUpdateOrderStatusUseCase(updateUseCase);

    const result = await uc.execute(['ord-A', 'ord-B'], 'confirmed', makeUser());

    const returnedIds = result.map((o) => o.id);
    expect(returnedIds).not.toContain('ord-B');
  });

  // ── State-machine guard delegation ────────────────────────────────────────

  it('propagates BusinessLogicError from UpdateOrderUseCase (invalid status transition) as a failure', async () => {
    // UpdateOrderUseCase.validateStatusTransition throws BusinessLogicError for illegal transitions
    // (e.g. delivered → pending). The bulk use case must treat this as a failure for that item,
    // not abort the whole batch, and must NOT surface which ID caused it.
    const { BusinessLogicError } = await import('@hbs/shared-kernel');
    const ordA = makeOrder({ id: 'ord-A', status: 'confirmed' });
    const updateUseCase = makeUpdateOrderUseCase({
      execute: jest
        .fn()
        .mockResolvedValueOnce(ordA)
        .mockRejectedValueOnce(new BusinessLogicError('Invalid status transition from delivered to pending')),
    });
    const uc = new BulkUpdateOrderStatusUseCase(updateUseCase);

    const result = await uc.execute(['ord-A', 'ord-B'], 'confirmed', makeUser());

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ord-A');
  });

  // ── currentUser forwarding ─────────────────────────────────────────────────

  it('forwards currentUser to every UpdateOrderUseCase.execute call', async () => {
    const user = makeUser({ userId: 'manager-1' });
    const updateUseCase = makeUpdateOrderUseCase();
    const uc = new BulkUpdateOrderStatusUseCase(updateUseCase);

    await uc.execute(['ord-1', 'ord-2'], 'confirmed', user);

    expect(updateUseCase.execute).toHaveBeenCalledWith('ord-1', { status: 'confirmed' }, user);
    expect(updateUseCase.execute).toHaveBeenCalledWith('ord-2', { status: 'confirmed' }, user);
  });

  it('forwards null currentUser (internal caller path)', async () => {
    const updateUseCase = makeUpdateOrderUseCase();
    const uc = new BulkUpdateOrderStatusUseCase(updateUseCase);

    await uc.execute(['ord-1'], 'confirmed', null);

    expect(updateUseCase.execute).toHaveBeenCalledWith('ord-1', { status: 'confirmed' }, null);
  });
});
