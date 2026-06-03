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

import { DeleteOrderUseCase } from '../DeleteOrderUseCase';
import type { IOrderRepository } from '../../../domain/repositories/IOrderRepository';
import type { Order } from '../../../domain/entities/Order';
import { NotFoundError, ValidationError } from '@hbs/shared-kernel';
import { GraphQLError } from 'graphql';
import type { TokenPayload } from '@hbs/auth';

// ── Factory helpers ────────────────────────────────────────────────────────────

function makeOwner(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-owner',
    email: 'owner@test.com',
    permissions: [],
    groups: ['customer'],
    ...overrides,
  };
}

function makeManagement(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-mgmt',
    email: 'mgmt@test.com',
    permissions: [],
    groups: ['sales-manager'],
    ...overrides,
  };
}

function makeOtherCustomer(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-other',
    email: 'other@test.com',
    permissions: [],
    groups: ['customer'],
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    userId: 'user-owner',
    orderNumber: 'ORD-2026-000001',
    customerEmail: 'owner@test.com',
    customerName: 'Test User',
    status: 'pending',
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

function makeRepo(overrides: Partial<jest.Mocked<IOrderRepository>> = {}): jest.Mocked<IOrderRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdUnrestricted: jest.fn().mockResolvedValue(makeOrder()),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn().mockResolvedValue(true),
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DeleteOrderUseCase', () => {
  // ── Validation ──────────────────────────────────────────────────────────────

  it('throws ValidationError when id is empty', async () => {
    const uc = new DeleteOrderUseCase(makeRepo());
    const err = await uc.execute('', makeOwner()).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
  });

  // ── Happy path: owner ────────────────────────────────────────────────────────

  it('owner can delete their own order', async () => {
    const repo = makeRepo();
    const uc = new DeleteOrderUseCase(repo);

    const result = await uc.execute('ord-1', makeOwner());

    // M-2 anti-enumeration: always returns the same ambiguous message.
    expect(result.success).toBe(true);
    expect(result.message).toBe('Operation completed');
    expect(repo.delete).toHaveBeenCalledWith('ord-1', expect.objectContaining({ userId: 'user-owner' }));
  });

  // ── Happy path: management ────────────────────────────────────────────────────

  it('management user can delete any order', async () => {
    const repo = makeRepo();
    const uc = new DeleteOrderUseCase(repo);

    const result = await uc.execute('ord-1', makeManagement());

    expect(result.success).toBe(true);
    expect(repo.delete).toHaveBeenCalled();
  });

  // ── BOLA: other customer sees ambiguous 404, NOT FORBIDDEN ───────────────────

  it('other customer (non-owner) → FORBIDDEN, not ambiguous 404', async () => {
    // The guard assertOwnerOrOrderManagement throws FORBIDDEN for non-owners who are
    // authenticated. The key property: non-owner gets FORBIDDEN BEFORE repo.delete
    // is called — no existence information leaks.
    const repo = makeRepo({
      // order owned by 'user-owner'
      findByIdUnrestricted: jest.fn().mockResolvedValue(makeOrder({ userId: 'user-owner' })),
    });
    const uc = new DeleteOrderUseCase(repo);

    const err = await uc.execute('ord-1', makeOtherCustomer()).catch((e) => e);
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.extensions?.code).toBe('FORBIDDEN');
    // The repo.delete must NOT have been called
    expect(repo.delete).not.toHaveBeenCalled();
  });

  // ── Unauthenticated ───────────────────────────────────────────────────────────

  it('anonymous caller → UNAUTHENTICATED', async () => {
    const repo = makeRepo();
    const uc = new DeleteOrderUseCase(repo);

    const err = await uc.execute('ord-1', null).catch((e) => e);
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.extensions?.code).toBe('UNAUTHENTICATED');
    expect(repo.delete).not.toHaveBeenCalled();
  });

  // ── Not found (via repo) ──────────────────────────────────────────────────────

  it('non-existent order → NotFoundError propagated from repo.delete', async () => {
    // findByIdUnrestricted returns null → ownerUserId becomes __not_found__
    // Owner guard: management user passes (does not check ownership)
    // repo.delete throws NotFoundError (ambiguous 404 from write-mode rule)
    const repo = makeRepo({
      findByIdUnrestricted: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockRejectedValue(new NotFoundError('Order', 'ord-x')),
    });
    const uc = new DeleteOrderUseCase(repo);

    const err = await uc.execute('ord-x', makeManagement()).catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundError);
  });

  // ── BOLA: non-owner non-management does NOT get to see whether order exists ───

  it('non-owner, non-management is rejected before repo.delete runs (BOLA closure)', async () => {
    // Even if the order does not exist, the guard fires before any DB call
    const repo = makeRepo({
      findByIdUnrestricted: jest.fn().mockResolvedValue(makeOrder({ userId: 'user-other-person' })),
    });
    const uc = new DeleteOrderUseCase(repo);

    const err = await uc.execute('ord-1', makeOtherCustomer()).catch((e) => e);
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.extensions?.code).toBe('FORBIDDEN');
    expect(repo.delete).not.toHaveBeenCalled();
  });

  // ── targetUserId shortcut ─────────────────────────────────────────────────────

  it('when targetUserId is provided, skips findByIdUnrestricted', async () => {
    const repo = makeRepo();
    const uc = new DeleteOrderUseCase(repo);

    await uc.execute('ord-1', makeOwner(), 'user-owner');

    // findByIdUnrestricted should NOT have been called since targetUserId was supplied
    expect(repo.findByIdUnrestricted).not.toHaveBeenCalled();
    expect(repo.delete).toHaveBeenCalled();
  });
});
