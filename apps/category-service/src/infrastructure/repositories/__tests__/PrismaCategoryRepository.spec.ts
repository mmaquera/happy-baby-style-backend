/**
 * Unit tests for PrismaCategoryRepository record-rule enforcement.
 *
 * These tests focus exclusively on the RBAC write-gate behaviour introduced in Fase 5.10
 * and corrected in the Fase 2 fix pass.
 *
 * Key semantics verified:
 *   - update/delete: assertWriteAccess runs; DENY_WHERE → NotFoundError; {} → allowed
 *   - create: record rules are NOT applied (no existing row to probe; model-level gate in resolver)
 *   - currentUser is forwarded through the resolveWhere call for update/delete/updateSortOrder
 */

jest.mock(
  '@hbs/logging',
  () => ({
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
  }),
  { virtual: true },
);

import { PrismaCategoryRepository } from '../PrismaCategoryRepository';
import { NotFoundError } from '@hbs/shared-kernel';
import type { RecordRuleResolver } from '@hbs/authz';
import type { TokenPayload } from '@hbs/auth';
import type { CategoryEntity } from '../../../domain/entities/Category';

// DENY_WHERE: the universal-deny shape produced by compileDomainExpr when access is denied.
const DENY_WHERE = { AND: [{ NOT: {} }] };

/** Factory for a minimal TokenPayload used in tests. */
const makeUser = (overrides: Partial<TokenPayload> = {}): TokenPayload => ({
  userId: 'user-1',
  email: 'admin@test.com',
  role: 'ADMIN' as any,
  groups: ['administrators'],
  permissions: ['categories:write'],
  ...overrides,
});

/** Factory for a minimal CategoryEntity used in tests. */
const makeCategory = (overrides: Partial<CategoryEntity> = {}): CategoryEntity =>
  ({
    id: 'cat-1',
    name: 'Ropa',
    slug: 'ropa',
    description: null,
    imageUrl: null,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as CategoryEntity;

/** Build a mock RecordRuleResolver that returns the given where clause for any resolveWhere call. */
const makeResolver = (ruleWhere: Record<string, unknown>): jest.Mocked<RecordRuleResolver> =>
  ({
    resolveWhere: jest.fn().mockResolvedValue(ruleWhere),
  }) as unknown as jest.Mocked<RecordRuleResolver>;

/** Build a minimal mock PrismaClient. */
const makePrisma = (findFirstResult: boolean = true) =>
  ({
    category: {
      create: jest.fn().mockResolvedValue({
        id: 'cat-1',
        name: 'Ropa',
        slug: 'ropa',
        description: null,
        image: null,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: jest.fn().mockResolvedValue({
        id: 'cat-1',
        name: 'Ropa',
        slug: 'ropa',
        description: null,
        image: null,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      findFirst: jest.fn().mockResolvedValue(findFirstResult ? { id: 'cat-1' } : null),
    },
  }) as any;

// ── update / write-mode tests ────────────────────────────────────────────────

describe('PrismaCategoryRepository — update write-gate', () => {
  it('allows update when resolver returns {} (no restriction)', async () => {
    const prisma = makePrisma(true);
    const resolver = makeResolver({});
    const repo = new PrismaCategoryRepository(prisma, resolver);

    await expect(
      repo.update('cat-1', { name: 'Nueva' }, makeUser()),
    ).resolves.toBeDefined();

    expect(prisma.category.update).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundError when resolver returns DENY_WHERE', async () => {
    const prisma = makePrisma(false); // findFirst returns null — DENY_WHERE never matches
    const resolver = makeResolver(DENY_WHERE);
    const repo = new PrismaCategoryRepository(prisma, resolver);

    await expect(
      repo.update('cat-1', { name: 'Nueva' }, makeUser()),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it('allows update when no resolver is injected (fail-open)', async () => {
    const prisma = makePrisma(true);
    const repo = new PrismaCategoryRepository(prisma);

    await expect(
      repo.update('cat-1', { name: 'Nueva' }),
    ).resolves.toBeDefined();
  });

  it('forwards currentUser into resolveWhere', async () => {
    const prisma = makePrisma(true);
    const resolver = makeResolver({});
    const repo = new PrismaCategoryRepository(prisma, resolver);
    const user = makeUser({ userId: 'u-99' });

    await repo.update('cat-1', { name: 'Nueva' }, user);

    expect(resolver.resolveWhere).toHaveBeenCalledWith('Category', 'write', user);
  });
});

// ── delete / unlink-mode tests ───────────────────────────────────────────────

describe('PrismaCategoryRepository — delete unlink-gate', () => {
  it('allows delete when resolver returns {} (no restriction)', async () => {
    const prisma = makePrisma(true);
    const resolver = makeResolver({});
    const repo = new PrismaCategoryRepository(prisma, resolver);

    await expect(repo.delete('cat-1', makeUser())).resolves.toBeUndefined();
    expect(prisma.category.delete).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundError when resolver returns DENY_WHERE', async () => {
    const prisma = makePrisma(false);
    const resolver = makeResolver(DENY_WHERE);
    const repo = new PrismaCategoryRepository(prisma, resolver);

    await expect(repo.delete('cat-1', makeUser())).rejects.toBeInstanceOf(NotFoundError);
    expect(prisma.category.delete).not.toHaveBeenCalled();
  });

  it('forwards currentUser into resolveWhere', async () => {
    const prisma = makePrisma(true);
    const resolver = makeResolver({});
    const repo = new PrismaCategoryRepository(prisma, resolver);
    const user = makeUser({ userId: 'u-77' });

    await repo.delete('cat-1', user);

    expect(resolver.resolveWhere).toHaveBeenCalledWith('Category', 'unlink', user);
  });
});

// ── create — no record-rule gating ──────────────────────────────────────────

describe('PrismaCategoryRepository — create (no record-rule gating)', () => {
  it('creates successfully regardless of resolver', async () => {
    // Even if the resolver would return DENY_WHERE, create must not call resolveWhere.
    const prisma = makePrisma(false); // findFirst returns null (unused by create)
    const resolver = makeResolver(DENY_WHERE);
    const repo = new PrismaCategoryRepository(prisma, resolver);

    await expect(
      repo.create(makeCategory(), makeUser()),
    ).resolves.toBeDefined();

    // The resolver must NOT be consulted during create.
    expect(resolver.resolveWhere).not.toHaveBeenCalled();
    expect(prisma.category.create).toHaveBeenCalledTimes(1);
  });

  it('creates successfully when no resolver is injected (fail-open)', async () => {
    const prisma = makePrisma(true);
    const repo = new PrismaCategoryRepository(prisma);

    await expect(repo.create(makeCategory())).resolves.toBeDefined();
    expect(prisma.category.create).toHaveBeenCalledTimes(1);
  });
});

// ── updateSortOrder / write-mode tests ───────────────────────────────────────

describe('PrismaCategoryRepository — updateSortOrder write-gate', () => {
  it('allows updateSortOrder when resolver returns {}', async () => {
    const prisma = makePrisma(true);
    const resolver = makeResolver({});
    const repo = new PrismaCategoryRepository(prisma, resolver);

    await expect(repo.updateSortOrder('cat-1', 5, makeUser())).resolves.toBeUndefined();
    expect(prisma.category.update).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundError when resolver returns DENY_WHERE on updateSortOrder', async () => {
    const prisma = makePrisma(false);
    const resolver = makeResolver(DENY_WHERE);
    const repo = new PrismaCategoryRepository(prisma, resolver);

    await expect(
      repo.updateSortOrder('cat-1', 5, makeUser()),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(prisma.category.update).not.toHaveBeenCalled();
  });
});
