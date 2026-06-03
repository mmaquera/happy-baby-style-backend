/**
 * Tests for order read-side use cases:
 *   - GetOrderByIdUseCase
 *   - GetOrdersUseCase (pagination, hasMore, filters, auth)
 *   - GetOrderStatsUseCase
 */

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

import { GetOrderByIdUseCase } from '../GetOrderByIdUseCase';
import { GetOrdersUseCase } from '../GetOrdersUseCase';
import { GetOrderStatsUseCase } from '../GetOrderStatsUseCase';
import type { IOrderRepository, OrderStats } from '../../../domain/repositories/IOrderRepository';
import type { Order } from '../../../domain/entities/Order';
import { ValidationError } from '@hbs/shared-kernel';
import type { TokenPayload } from '@hbs/auth';

// ── Factory helpers ────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    userId: 'user-1',
    orderNumber: 'ORD-2026-000001',
    customerEmail: 'owner@test.com',
    customerName: 'Test User',
    status: 'pending',
    paymentStatus: 'pending',
    subtotal: 100,
    taxAmount: 18,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: 118,
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
    permissions: [],
    groups: ['customer'],
    ...overrides,
  };
}

function makeStats(): OrderStats {
  return {
    totalOrders: 10,
    pendingOrders: 3,
    processingOrders: 2,
    shippedOrders: 1,
    deliveredOrders: 3,
    cancelledOrders: 1,
    totalRevenue: 1000,
    averageOrderValue: 100,
    todayOrders: 2,
    todayRevenue: 200,
    activeCoupons: 5,
  };
}

function makeRepo(overrides: Partial<jest.Mocked<IOrderRepository>> = {}): jest.Mocked<IOrderRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(makeOrder()),
    findByIdUnrestricted: jest.fn().mockResolvedValue(makeOrder()),
    findAll: jest.fn().mockResolvedValue([makeOrder()]),
    update: jest.fn(),
    delete: jest.fn(),
    findByStatus: jest.fn(),
    findByCustomerEmail: jest.fn(),
    updateStatus: jest.fn(),
    addOrderItem: jest.fn(),
    removeOrderItem: jest.fn(),
    getOrderItems: jest.fn(),
    createShippingAddress: jest.fn(),
    getShippingAddress: jest.fn(),
    getOrderStats: jest.fn().mockResolvedValue(makeStats()),
    getOrdersByDateRange: jest.fn(),
    ensureWritable: jest.fn(),
    ...overrides,
  } as jest.Mocked<IOrderRepository>;
}

// ===========================================================================
// GetOrderByIdUseCase
// ===========================================================================

describe('GetOrderByIdUseCase', () => {
  it('throws ValidationError when id is empty string', async () => {
    const uc = new GetOrderByIdUseCase(makeRepo());
    const err = await uc.execute('', makeUser()).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('Order ID is required');
  });

  it('returns null when order not found (record-rule hides it)', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new GetOrderByIdUseCase(repo);

    const result = await uc.execute('ord-x', makeUser());
    expect(result).toBeNull();
  });

  it('returns the order for the authenticated owner', async () => {
    const repo = makeRepo();
    const uc = new GetOrderByIdUseCase(repo);

    const result = await uc.execute('ord-1', makeUser());
    expect(result?.id).toBe('ord-1');
    expect(repo.findById).toHaveBeenCalledWith('ord-1', expect.objectContaining({ userId: 'user-1' }));
  });

  it('forwards null currentUser to repo (unauthenticated path)', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new GetOrderByIdUseCase(repo);

    await uc.execute('ord-1', null);
    expect(repo.findById).toHaveBeenCalledWith('ord-1', null);
  });

  it('defaults currentUser to null when not provided', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new GetOrderByIdUseCase(repo);

    await uc.execute('ord-1');
    expect(repo.findById).toHaveBeenCalledWith('ord-1', null);
  });
});

// ===========================================================================
// GetOrdersUseCase
// ===========================================================================

describe('GetOrdersUseCase', () => {
  it('returns orders with hasMore=false when result is smaller than limit', async () => {
    const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([makeOrder()]) });
    const uc = new GetOrdersUseCase(repo);

    const result = await uc.execute({ pagination: { limit: 10 } });

    expect(result.orders).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it('returns hasMore=true when result length equals limit', async () => {
    // When the repo returns exactly `limit` items, we infer there may be more.
    const limit = 3;
    const orders = Array.from({ length: limit }, (_, i) =>
      makeOrder({ id: `ord-${i}`, orderNumber: `ORD-2026-00000${i}` }),
    );
    const repo = makeRepo({ findAll: jest.fn().mockResolvedValue(orders) });
    const uc = new GetOrdersUseCase(repo);

    const result = await uc.execute({ pagination: { limit } });

    expect(result.hasMore).toBe(true);
  });

  it('passes pagination to findAll', async () => {
    const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([]) });
    const uc = new GetOrdersUseCase(repo);

    await uc.execute({ pagination: { limit: 5, offset: 20 } });

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, offset: 20 }),
      null,
    );
  });

  it('passes filters to findAll', async () => {
    const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([]) });
    const uc = new GetOrdersUseCase(repo);

    await uc.execute({
      filters: { userId: 'user-1', status: 'pending', orderNumber: 'ORD-2026-000001' },
    });

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', status: 'pending', orderNumber: 'ORD-2026-000001' }),
      null,
    );
  });

  it('forwards currentUser to repo.findAll for record-rule filtering', async () => {
    const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([]) });
    const uc = new GetOrdersUseCase(repo);
    const user = makeUser({ userId: 'user-mgmt', groups: ['sales-manager'] });

    await uc.execute({ currentUser: user });

    expect(repo.findAll).toHaveBeenCalledWith(expect.any(Object), user);
  });

  it('defaults to limit=50, offset=0 when pagination is omitted', async () => {
    const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([]) });
    const uc = new GetOrdersUseCase(repo);

    await uc.execute();

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 }),
      null,
    );
  });

  it('total accounts for hasMore offset', async () => {
    // hasMore=true → total = offset + result.length + 1 (signals more pages)
    const limit = 2;
    const orders = Array.from({ length: limit }, (_, i) =>
      makeOrder({ id: `ord-${i}`, orderNumber: `ORD-2026-00000${i}` }),
    );
    const repo = makeRepo({ findAll: jest.fn().mockResolvedValue(orders) });
    const uc = new GetOrdersUseCase(repo);

    const result = await uc.execute({ pagination: { limit, offset: 10 } });

    // offset(10) + results(2) + hasMoreSentinel(1) = 13
    expect(result.total).toBe(13);
  });
});

// ===========================================================================
// GetOrderStatsUseCase
// ===========================================================================

describe('GetOrderStatsUseCase', () => {
  it('returns stats from the repository', async () => {
    const repo = makeRepo();
    const uc = new GetOrderStatsUseCase(repo);

    const result = await uc.execute();

    expect(result.totalOrders).toBe(10);
    expect(result.totalRevenue).toBe(1000);
    expect(result.activeCoupons).toBe(5);
    expect(repo.getOrderStats).toHaveBeenCalledTimes(1);
  });

  it('propagates errors from the repository', async () => {
    const repo = makeRepo({
      getOrderStats: jest.fn().mockRejectedValue(new Error('DB error')),
    });
    const uc = new GetOrderStatsUseCase(repo);

    await expect(uc.execute()).rejects.toThrow('DB error');
  });
});
