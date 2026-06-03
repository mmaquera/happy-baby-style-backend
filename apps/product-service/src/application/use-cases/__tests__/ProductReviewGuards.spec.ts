/**
 * ProductReviewGuards.spec.ts
 *
 * Tests for BOLA/auth security guards and error mapping on review mutations.
 *
 * The resolver now delegates ALL review ops to use cases injected via repositories.
 * There are no "fallback prisma.*" paths — the test layer drives behavior through
 * repository mocks that the use cases consume.
 *
 * What is tested here:
 *   - createProductReview: UNAUTHENTICATED when no currentUser
 *   - createProductReview: DuplicateError from use case → CONFLICT
 *   - createProductReview: NotFoundError from use case → NOT_FOUND
 *   - createProductReview: Prisma P2002 surface → CONFLICT
 *   - createProductReview: Prisma P2003 surface → NOT_FOUND (no schema leak)
 *   - createProductReview: unknown error → re-thrown
 *   - createReviewVote: voter pinned to JWT userId (BOLA fix, still via prisma.reviewVote.upsert)
 *   - createReviewVote: UNAUTHENTICATED when no currentUser
 *   - createReviewVote: Prisma P2003 FK → NOT_FOUND
 *   - deleteReviewVote: ownership enforced (own vote → success)
 *   - deleteReviewVote: another user's vote → NOT_FOUND (anti-enumeration)
 *   - deleteReviewVote: vote does not exist → NOT_FOUND
 *   - deleteReviewVote: UNAUTHENTICATED when no currentUser
 *   - deleteReviewVote: admin without own vote → NOT_FOUND (no scope-creep)
 *   - updateProductReview: owner can update their own review (via use case / repo mock)
 *   - updateProductReview: non-owner non-admin → NOT_FOUND
 *   - updateProductReview: review does not exist → NOT_FOUND
 *   - updateProductReview: admin can update any review
 */

jest.mock(
  '@hbs/logging',
  () => ({
    LoggerFactory: {
      getInstance: () => ({
        createServiceLogger: () => ({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        }),
        createUseCaseLogger: () => ({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        }),
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

jest.mock('@hbs/auth', () => ({
  requirePermission: jest.fn(),
  Permission: {},
}));

jest.mock(
  '@hbs/authz',
  () => ({
    assertModelAccess: jest.fn(),
    hasPermission: jest.fn().mockReturnValue(true),
    isAdmin: jest.fn((user: any) => {
      if (!user) return false;
      return (user.groups ?? []).includes('administrators');
    }),
  }),
  { virtual: true },
);

import { Prisma } from '../../../prisma';
import type { TokenPayload } from '@hbs/auth';
import type { IProductReviewRepository } from '../../../domain/repositories/IProductReviewRepository';
import type { IInventoryTransactionRepository } from '../../../domain/repositories/IInventoryTransactionRepository';
import type { IStockAlertRepository } from '../../../domain/repositories/IStockAlertRepository';
import { ProductReviewEntity } from '../../../domain/entities/ProductReview';
import { NotFoundError, DuplicateError } from '../../../domain/errors/DomainError';

// ── Factories ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: overrides.userId ?? 'user-jwt-1',
    email: overrides.email ?? 'user@test.com',
    groups: overrides.groups ?? ['customer'],
    permissions: overrides.permissions ?? [],
  };
}

function makeAdminUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: overrides.userId ?? 'admin-jwt-1',
    email: overrides.email ?? 'admin@test.com',
    groups: overrides.groups ?? ['administrators'],
    permissions: overrides.permissions ?? ['products:write'],
  };
}

function makeReviewEntity(overrides: Partial<any> = {}): ProductReviewEntity {
  return new ProductReviewEntity(
    overrides.id ?? 'rev-1',
    overrides.productId ?? 'prod-1',
    overrides.userId ?? 'owner-user-1',
    overrides.rating ?? 4,
    overrides.isApproved ?? false,
    false,
    0,
    overrides.status ?? 'pending',
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    overrides.title ?? 'Good product',
    overrides.comment ?? undefined,
  );
}

// ── Minimal IProductRepository mock ───────────────────────────────────────────

function makeProductRepoMock(): any {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdUnrestricted: jest.fn(),
    ensureWritable: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findByCategory: jest.fn(),
    findBySku: jest.fn(),
    updateStock: jest.fn(),
    search: jest.fn(),
    findLowStock: jest.fn(),
    findOutOfStock: jest.fn(),
    createVariant: jest.fn(),
    getProductVariants: jest.fn(),
    updateVariant: jest.fn(),
    deleteVariant: jest.fn(),
  };
}

function makeReviewRepoMock(overrides: Partial<IProductReviewRepository> = {}): jest.Mocked<IProductReviewRepository> {
  return {
    create: jest.fn().mockResolvedValue(makeReviewEntity()),
    findById: jest.fn().mockResolvedValue(makeReviewEntity()),
    findByProduct: jest.fn().mockResolvedValue({ reviews: [], total: 0 }),
    findByUser: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(makeReviewEntity()),
    delete: jest.fn().mockResolvedValue(undefined),
    approve: jest.fn().mockResolvedValue(makeReviewEntity({ status: 'approved', isApproved: true })),
    reject: jest.fn().mockResolvedValue(makeReviewEntity({ status: 'rejected', isApproved: false })),
    ...overrides,
  } as jest.Mocked<IProductReviewRepository>;
}

function makeInventoryRepoMock(): jest.Mocked<IInventoryTransactionRepository> {
  return {
    create: jest.fn(),
    findByProductId: jest.fn().mockResolvedValue([]),
  } as any;
}

function makeStockAlertRepoMock(): jest.Mocked<IStockAlertRepository> {
  return {
    create: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
  } as any;
}

// ── Minimal prisma mock (for reviewVote operations still in resolver) ──────────

function makePrismaMock(overrides: Record<string, any> = {}) {
  return {
    productReview: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    reviewVote: {
      upsert: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
    ...overrides,
  };
}

// ── Resolver factory import ────────────────────────────────────────────────────

import { createResolvers } from '../../../graphql/resolvers';

function getMutation(resolvers: any, name: string) {
  return resolvers.Mutation[name];
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Review mutation security guards', () => {

  // ── createProductReview ──────────────────────────────────────────────────────

  describe('createProductReview', () => {
    it('throws UNAUTHENTICATED when currentUser is null', async () => {
      const prisma = makePrismaMock();
      const resolvers = createResolvers(
        makeProductRepoMock(), prisma as any,
        makeReviewRepoMock(), makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'createProductReview');

      await expect(
        mutation(null, { input: { productId: 'prod-1', rating: 5 } }, { currentUser: null }),
      ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });
    });

    it('throws UNAUTHENTICATED when context has no currentUser property', async () => {
      const prisma = makePrismaMock();
      const resolvers = createResolvers(
        makeProductRepoMock(), prisma as any,
        makeReviewRepoMock(), makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'createProductReview');

      await expect(
        mutation(null, { input: { productId: 'prod-1', rating: 5 } }, {}),
      ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });
    });

    it('maps DuplicateError from use case to CONFLICT (409)', async () => {
      const reviewRepo = makeReviewRepoMock({
        create: jest.fn().mockRejectedValue(new DuplicateError('ProductReview', 'productId+userId', 'duplicate')),
      });
      // findById must exist so CreateProductReviewUseCase can validate the product
      const productRepo = makeProductRepoMock();
      productRepo.findById.mockResolvedValue({ id: 'prod-1' });

      const prisma = makePrismaMock();
      const resolvers = createResolvers(
        productRepo, prisma as any,
        reviewRepo, makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'createProductReview');

      await expect(
        mutation(null, { input: { productId: 'prod-1', rating: 5 } }, { currentUser: makeUser() }),
      ).rejects.toMatchObject({ extensions: { code: 'CONFLICT', http: { status: 409 } } });
    });

    it('maps NotFoundError from use case to NOT_FOUND (no schema leak)', async () => {
      const productRepo = makeProductRepoMock();
      productRepo.findById.mockResolvedValue(null); // product not found

      const prisma = makePrismaMock();
      const resolvers = createResolvers(
        productRepo, prisma as any,
        makeReviewRepoMock(), makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'createProductReview');

      await expect(
        mutation(null, { input: { productId: 'nonexistent-prod', rating: 5 } }, { currentUser: makeUser() }),
      ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
    });

    it('maps Prisma P2002 (unique constraint) to CONFLICT — message must not expose internal details', async () => {
      const uniqueError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      const reviewRepo = makeReviewRepoMock({
        create: jest.fn().mockRejectedValue(uniqueError),
      });
      const productRepo = makeProductRepoMock();
      productRepo.findById.mockResolvedValue({ id: 'prod-1' });

      const prisma = makePrismaMock();
      const resolvers = createResolvers(
        productRepo, prisma as any,
        reviewRepo, makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'createProductReview');

      const thrownError = await mutation(
        null, { input: { productId: 'prod-1', rating: 4 } }, { currentUser: makeUser() },
      ).catch((e: unknown) => e);

      expect((thrownError as any).extensions.code).toBe('CONFLICT');
      const msg = (thrownError as Error).message;
      expect(msg).not.toMatch(/unique constraint/i);
      expect(msg).not.toMatch(/prisma/i);
    });

    it('maps Prisma P2003 (FK violation — productId not found) to NOT_FOUND (no schema leak)', async () => {
      const fkError = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
      });
      const reviewRepo = makeReviewRepoMock({
        create: jest.fn().mockRejectedValue(fkError),
      });
      const productRepo = makeProductRepoMock();
      // product found (passes use-case guard) but Prisma FK fails on insert
      productRepo.findById.mockResolvedValue({ id: 'prod-1' });

      const prisma = makePrismaMock();
      const resolvers = createResolvers(
        productRepo, prisma as any,
        reviewRepo, makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'createProductReview');

      const thrownError = await mutation(
        null, { input: { productId: 'prod-1', rating: 5 } }, { currentUser: makeUser() },
      ).catch((e: unknown) => e);

      expect((thrownError as any).extensions.code).toBe('NOT_FOUND');
      const msg = (thrownError as Error).message;
      expect(msg).not.toMatch(/foreign key/i);
      expect(msg).not.toMatch(/constraint/i);
      expect(msg).not.toMatch(/prisma/i);
    });

    it('re-throws unknown non-Prisma errors without swallowing', async () => {
      const reviewRepo = makeReviewRepoMock({
        create: jest.fn().mockRejectedValue(new Error('database connection lost')),
      });
      const productRepo = makeProductRepoMock();
      productRepo.findById.mockResolvedValue({ id: 'prod-1' });

      const prisma = makePrismaMock();
      const resolvers = createResolvers(
        productRepo, prisma as any,
        reviewRepo, makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'createProductReview');

      await expect(
        mutation(null, { input: { productId: 'prod-1', rating: 5 } }, { currentUser: makeUser() }),
      ).rejects.toThrow('database connection lost');
    });
  });

  // ── createReviewVote ─────────────────────────────────────────────────────────
  // reviewVote mutations are still resolver-level (no use case yet) — prisma mock

  describe('createReviewVote', () => {
    it('pins voter to JWT userId — ignores any userId in input (BOLA fix)', async () => {
      const prisma = makePrismaMock();
      const jwtUserId = 'user-jwt-1';

      const createdVote = {
        id: 'vote-1',
        reviewId: 'rev-1',
        userId: jwtUserId,
        isHelpful: true,
        createdAt: new Date(),
      };
      prisma.reviewVote.upsert.mockResolvedValue(createdVote);

      const resolvers = createResolvers(
        makeProductRepoMock(), prisma as any,
        makeReviewRepoMock(), makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'createReviewVote');

      const result = await mutation(
        null,
        { input: { reviewId: 'rev-1', isHelpful: true } },
        { currentUser: makeUser({ userId: jwtUserId }) },
      );

      expect(prisma.reviewVote.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { reviewId_userId: { reviewId: 'rev-1', userId: jwtUserId } },
          create: expect.objectContaining({ userId: jwtUserId }),
        }),
      );
      expect(result.userId).toBe(jwtUserId);
    });

    it('throws UNAUTHENTICATED when currentUser is null', async () => {
      const prisma = makePrismaMock();
      const resolvers = createResolvers(
        makeProductRepoMock(), prisma as any,
        makeReviewRepoMock(), makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'createReviewVote');

      await expect(
        mutation(null, { input: { reviewId: 'rev-1', isHelpful: true } }, { currentUser: null }),
      ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });

      expect(prisma.reviewVote.upsert).not.toHaveBeenCalled();
    });

    it('throws UNAUTHENTICATED when context has no currentUser property', async () => {
      const prisma = makePrismaMock();
      const resolvers = createResolvers(
        makeProductRepoMock(), prisma as any,
        makeReviewRepoMock(), makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'createReviewVote');

      await expect(
        mutation(null, { input: { reviewId: 'rev-1', isHelpful: true } }, {}),
      ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });
    });

    it('maps Prisma P2003 (FK violation — reviewId not found) to NOT_FOUND (no schema leak)', async () => {
      const prisma = makePrismaMock();
      const fkError = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
      });
      prisma.reviewVote.upsert.mockRejectedValue(fkError);

      const resolvers = createResolvers(
        makeProductRepoMock(), prisma as any,
        makeReviewRepoMock(), makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'createReviewVote');

      const thrownError = await mutation(
        null, { input: { reviewId: 'nonexistent-rev', isHelpful: true } }, { currentUser: makeUser() },
      ).catch((e: unknown) => e);

      expect((thrownError as any).extensions.code).toBe('NOT_FOUND');
      const msg = (thrownError as Error).message;
      expect(msg).not.toMatch(/foreign key/i);
      expect(msg).not.toMatch(/constraint/i);
      expect(msg).not.toMatch(/prisma/i);
    });
  });

  // ── deleteReviewVote ─────────────────────────────────────────────────────────

  describe('deleteReviewVote', () => {
    it('allows owner to delete their own vote', async () => {
      const prisma = makePrismaMock();
      const callerId = 'user-jwt-1';

      const ownedVote = {
        id: 'vote-1',
        reviewId: 'rev-1',
        userId: callerId,
        isHelpful: true,
        createdAt: new Date(),
      };
      prisma.reviewVote.findUnique.mockResolvedValue(ownedVote);
      prisma.reviewVote.delete.mockResolvedValue(ownedVote);

      const resolvers = createResolvers(
        makeProductRepoMock(), prisma as any,
        makeReviewRepoMock(), makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'deleteReviewVote');

      const result = await mutation(null, { reviewId: 'rev-1' }, { currentUser: makeUser({ userId: callerId }) });

      expect(result.success).toBe(true);
      expect(prisma.reviewVote.delete).toHaveBeenCalledWith({
        where: { reviewId_userId: { reviewId: 'rev-1', userId: callerId } },
      });
    });

    it('throws NOT_FOUND (anti-enumeration) when vote belongs to another user', async () => {
      const prisma = makePrismaMock();
      prisma.reviewVote.findUnique.mockResolvedValue(null);

      const resolvers = createResolvers(
        makeProductRepoMock(), prisma as any,
        makeReviewRepoMock(), makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'deleteReviewVote');

      await expect(
        mutation(null, { reviewId: 'rev-1' }, { currentUser: makeUser({ userId: 'attacker-user-2' }) }),
      ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });

      expect(prisma.reviewVote.delete).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND when vote does not exist at all', async () => {
      const prisma = makePrismaMock();
      prisma.reviewVote.findUnique.mockResolvedValue(null);

      const resolvers = createResolvers(
        makeProductRepoMock(), prisma as any,
        makeReviewRepoMock(), makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'deleteReviewVote');

      await expect(
        mutation(null, { reviewId: 'nonexistent-rev' }, { currentUser: makeUser() }),
      ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });

      expect(prisma.reviewVote.delete).not.toHaveBeenCalled();
    });

    it('throws UNAUTHENTICATED when currentUser is null', async () => {
      const prisma = makePrismaMock();
      const resolvers = createResolvers(
        makeProductRepoMock(), prisma as any,
        makeReviewRepoMock(), makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'deleteReviewVote');

      await expect(
        mutation(null, { reviewId: 'rev-1' }, { currentUser: null }),
      ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });

      expect(prisma.reviewVote.findUnique).not.toHaveBeenCalled();
      expect(prisma.reviewVote.delete).not.toHaveBeenCalled();
    });

    it('throws UNAUTHENTICATED when context has no currentUser property', async () => {
      const prisma = makePrismaMock();
      const resolvers = createResolvers(
        makeProductRepoMock(), prisma as any,
        makeReviewRepoMock(), makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'deleteReviewVote');

      await expect(
        mutation(null, { reviewId: 'rev-1' }, {}),
      ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });
    });

    it('admin receives NOT_FOUND when no vote exists for their own userId (no scope-creep)', async () => {
      const prisma = makePrismaMock();
      prisma.reviewVote.findUnique.mockResolvedValue(null);

      const resolvers = createResolvers(
        makeProductRepoMock(), prisma as any,
        makeReviewRepoMock(), makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'deleteReviewVote');

      await expect(
        mutation(null, { reviewId: 'rev-1' }, { currentUser: makeAdminUser() }),
      ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });

      expect(prisma.reviewVote.delete).not.toHaveBeenCalled();
    });
  });

  // ── updateProductReview (BOLA via use case — owner-or-admin) ─────────────────
  //
  // The resolver delegates to UpdateProductReviewUseCase which enforces owner-or-admin.
  // We drive behavior by controlling what reviewRepository.findById returns.

  describe('updateProductReview', () => {
    it('allows owner to edit their own review', async () => {
      const ownerId = 'owner-user-1';
      const review = makeReviewEntity({ userId: ownerId });
      const updatedReview = makeReviewEntity({ userId: ownerId, title: 'Updated title' });

      const reviewRepo = makeReviewRepoMock({
        findById: jest.fn().mockResolvedValue(review),
        update: jest.fn().mockResolvedValue(updatedReview),
      });

      const resolvers = createResolvers(
        makeProductRepoMock(), makePrismaMock() as any,
        reviewRepo, makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'updateProductReview');

      const result = await mutation(
        null,
        { id: 'rev-1', input: { title: 'Updated title' } },
        { currentUser: makeUser({ userId: ownerId }) },
      );

      expect(reviewRepo.findById).toHaveBeenCalledWith('rev-1');
      expect(reviewRepo.update).toHaveBeenCalled();
      expect(result.title).toBe('Updated title');
    });

    it('throws NOT_FOUND (anti-enumeration) when non-owner non-admin attempts edit', async () => {
      // Review belongs to owner-user-1 — attacker is a different user
      const review = makeReviewEntity({ userId: 'owner-user-1' });
      const reviewRepo = makeReviewRepoMock({
        findById: jest.fn().mockResolvedValue(review),
      });

      const resolvers = createResolvers(
        makeProductRepoMock(), makePrismaMock() as any,
        reviewRepo, makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'updateProductReview');

      await expect(
        mutation(
          null,
          { id: 'rev-1', input: { title: 'Hacked' } },
          { currentUser: makeUser({ userId: 'attacker-user-2', groups: ['customer'] }) },
        ),
      ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });

      expect(reviewRepo.update).not.toHaveBeenCalled();
    });

    it('allows admin to edit any review regardless of ownership', async () => {
      const review = makeReviewEntity({ userId: 'regular-user-1' });
      const updatedReview = makeReviewEntity({ userId: 'regular-user-1', rating: 3 });

      const reviewRepo = makeReviewRepoMock({
        findById: jest.fn().mockResolvedValue(review),
        update: jest.fn().mockResolvedValue(updatedReview),
      });

      const resolvers = createResolvers(
        makeProductRepoMock(), makePrismaMock() as any,
        reviewRepo, makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'updateProductReview');

      const result = await mutation(
        null,
        { id: 'rev-1', input: { rating: 3 } },
        { currentUser: makeAdminUser() },
      );

      expect(reviewRepo.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws NOT_FOUND (anti-enumeration) when review does not exist', async () => {
      const reviewRepo = makeReviewRepoMock({
        findById: jest.fn().mockResolvedValue(null),
      });

      const resolvers = createResolvers(
        makeProductRepoMock(), makePrismaMock() as any,
        reviewRepo, makeInventoryRepoMock(), makeStockAlertRepoMock(),
      );
      const mutation = getMutation(resolvers, 'updateProductReview');

      await expect(
        mutation(
          null,
          { id: 'nonexistent-rev', input: { title: 'Ghost' } },
          { currentUser: makeUser() },
        ),
      ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });

      expect(reviewRepo.update).not.toHaveBeenCalled();
    });
  });
});
