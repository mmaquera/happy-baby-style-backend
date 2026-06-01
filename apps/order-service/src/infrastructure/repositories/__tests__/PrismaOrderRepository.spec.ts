/**
 * Unit tests for PrismaOrderRepository — record-rule filtering (Fase 5.8 pilot).
 *
 * Strategy: mock Prisma and RecordRuleResolver; verify that the `where` clause
 * passed to prisma.order.findMany / findFirst correctly includes the rule-where.
 */

jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createRepositoryLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    }),
  },
}), { virtual: true });

import { PrismaOrderRepository } from '../PrismaOrderRepository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrismaOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ord-1',
    userId: 'u1',
    orderNumber: 'ORD-001',
    customerEmail: 'a@b.com',
    customerName: 'Test',
    status: 'pending',
    subtotal: 10,
    taxAmount: 0,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: 10,
    currency: 'PEN',
    shippingStreet: '123 Main',
    shippingCity: 'Lima',
    shippingState: 'Lima',
    shippingZipCode: '15001',
    shippingCountry: 'PE',
    shippingAddressId: null,
    notes: '',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deliveredAt: null,
    items: [],
    ...overrides,
  };
}

function makeMockPrisma() {
  return {
    order: {
      findMany: jest.fn().mockResolvedValue([makePrismaOrder()]),
      findFirst: jest.fn().mockResolvedValue(makePrismaOrder()),
      findUnique: jest.fn().mockResolvedValue(makePrismaOrder()),
    },
  } as any;
}

function makeMockResolver(resolvedWhere: Record<string, unknown> = {}) {
  return {
    resolveWhere: jest.fn().mockResolvedValue(resolvedWhere),
  } as any;
}

function makeMockUser() {
  return {
    userId: 'u1',
    email: 'user@example.com',
    role: 'customer',
    groups: ['sales-user'],
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PrismaOrderRepository — findAll with RecordRuleResolver', () => {
  it('passes mergedWhere with AND when resolver returns a non-empty filter', async () => {
    const prisma = makeMockPrisma();
    const ruleWhere = { status: { equals: 'confirmed' } };
    const resolver = makeMockResolver(ruleWhere);

    const repo = new PrismaOrderRepository(prisma, resolver);
    const user = makeMockUser();

    await repo.findAll({ status: 'pending' }, user);

    expect(resolver.resolveWhere).toHaveBeenCalledWith('Order', 'read', user);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            expect.objectContaining({ status: 'pending' }),
            ruleWhere,
          ],
        },
      }),
    );
  });

  it('passes filterWhere directly when resolver returns {} (no restriction)', async () => {
    const prisma = makeMockPrisma();
    const resolver = makeMockResolver({});

    const repo = new PrismaOrderRepository(prisma, resolver);

    await repo.findAll({ userId: 'u1' }, makeMockUser());

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u1' }),
      }),
    );
    // Should NOT be wrapped in AND when ruleWhere is empty
    const callArg = prisma.order.findMany.mock.calls[0][0];
    expect(callArg.where).not.toHaveProperty('AND');
  });

  it('passes DENY_WHERE when resolver returns impossible filter', async () => {
    const prisma = makeMockPrisma();
    const denyWhere = { AND: [{ NOT: {} }] };
    const resolver = makeMockResolver(denyWhere);

    const repo = new PrismaOrderRepository(prisma, resolver);

    await repo.findAll({}, null);

    const callArg = prisma.order.findMany.mock.calls[0][0];
    expect(callArg.where).toMatchObject({ AND: expect.arrayContaining([denyWhere]) });
  });

  it('passes no ruleWhere when resolver is not injected (backward-compat)', async () => {
    const prisma = makeMockPrisma();
    // No resolver
    const repo = new PrismaOrderRepository(prisma);

    await repo.findAll({ status: 'pending' });

    const callArg = prisma.order.findMany.mock.calls[0][0];
    expect(callArg.where).toEqual(expect.objectContaining({ status: 'pending' }));
    expect(callArg.where).not.toHaveProperty('AND');
  });
});

describe('PrismaOrderRepository — findById with RecordRuleResolver', () => {
  it('uses findFirst with AND[{id}, ruleWhere] when resolver returns a filter', async () => {
    const prisma = makeMockPrisma();
    const ruleWhere = { userId: { equals: 'u1' } };
    const resolver = makeMockResolver(ruleWhere);

    const repo = new PrismaOrderRepository(prisma, resolver);
    const user = makeMockUser();

    await repo.findById('ord-1', user);

    expect(resolver.resolveWhere).toHaveBeenCalledWith('Order', 'read', user);
    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ id: 'ord-1' }, ruleWhere] },
      }),
    );
  });

  it('returns null when findFirst returns null (order not found or denied)', async () => {
    const prisma = makeMockPrisma();
    prisma.order.findFirst.mockResolvedValue(null);
    const resolver = makeMockResolver({ AND: [{ NOT: {} }] });

    const repo = new PrismaOrderRepository(prisma, resolver);
    const result = await repo.findById('ord-1', null);

    expect(result).toBeNull();
  });

  it('works without resolver — uses {} ruleWhere', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaOrderRepository(prisma);

    await repo.findById('ord-1', null);

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ id: 'ord-1' }, {}] },
      }),
    );
  });
});
