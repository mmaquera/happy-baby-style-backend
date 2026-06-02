/**
 * ProductReviewGuards.spec.ts
 *
 * Tests for the BOLA/auth security guards on review mutations.
 *
 * These guards live in the resolver layer (graphql/resolvers.ts) because no
 * dedicated use case exists yet for review/vote operations — all DB access is
 * via prisma directly in the resolver.  When the structural refactor is done
 * (CreateProductReviewUseCase, CreateReviewVoteUseCase, DeleteReviewVoteUseCase),
 * these tests should move to the corresponding use-case __tests__ files.
 *
 * What is tested here:
 *   - createProductReview: author is pinned to JWT userId (not input.userId)
 *   - createProductReview: unauthenticated caller → UNAUTHENTICATED
 *   - createReviewVote: voter is pinned to JWT userId (not input.userId)
 *   - createReviewVote: unauthenticated caller → UNAUTHENTICATED
 *   - deleteReviewVote: ownership enforced (own vote → success)
 *   - deleteReviewVote: vote belonging to another user → NOT_FOUND (anti-enumeration)
 *   - deleteReviewVote: vote does not exist at all → NOT_FOUND
 *   - deleteReviewVote: unauthenticated caller → UNAUTHENTICATED
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
      }),
    },
  }),
  { virtual: true },
);

jest.mock('@hbs/auth', () => ({
  requirePermission: jest.fn(),
  Permission: {},
}));

jest.mock('@hbs/authz', () => ({
  assertModelAccess: jest.fn(),
}));

import { GraphQLError } from 'graphql';
import type { TokenPayload } from '@hbs/auth';

// ── Factories ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: overrides.userId ?? 'user-jwt-1',
    email: overrides.email ?? 'user@test.com',
    role: overrides.role ?? ('customer' as any),
    groups: overrides.groups ?? ['customer'],
    permissions: overrides.permissions ?? [],
  };
}

function makeAdminUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: overrides.userId ?? 'admin-jwt-1',
    email: overrides.email ?? 'admin@test.com',
    role: overrides.role ?? ('admin' as any),
    groups: overrides.groups ?? ['administrators'],
    permissions: overrides.permissions ?? ['products:write'],
  };
}

// ── Minimal prisma mock ────────────────────────────────────────────────────────

function makePrismaMock(overrides: Record<string, any> = {}) {
  return {
    productReview: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    reviewVote: {
      upsert: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    inventoryTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    stockAlert: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
    ...overrides,
  };
}

// ── Minimal IProductRepository mock ───────────────────────────────────────────

function makeRepoMock(): any {
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
    createVariant: jest.fn(),
    getProductVariants: jest.fn(),
    updateVariant: jest.fn(),
    deleteVariant: jest.fn(),
  };
}

// ── Resolver factory import ────────────────────────────────────────────────────

// We import createResolvers after all mocks are set up so the module picks up
// the mocked logging + auth dependencies.
import { createResolvers } from '../../../graphql/resolvers';

// ── Helper to extract a resolver from the map ──────────────────────────────────

function getMutation(resolvers: any, name: string) {
  return resolvers.Mutation[name];
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Review mutation security guards', () => {

  // ── createProductReview ──────────────────────────────────────────────────────

  describe('createProductReview', () => {
    it('pins author to JWT userId — ignores any userId that might be in input (BOLA fix)', async () => {
      const prisma = makePrismaMock();
      const jwtUserId = 'user-jwt-1';
      const spoofedUserId = 'victim-user-99';

      const createdReview = {
        id: 'rev-1',
        productId: 'prod-1',
        userId: jwtUserId,
        rating: 5,
        title: 'Great',
        comment: null,
        isApproved: false,
        isVerified: false,
        helpfulCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        photos: [],
        votes: [],
      };

      prisma.productReview.create.mockResolvedValue(createdReview);

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'createProductReview');

      // Client sends a spoofed userId in the input — server must ignore it
      const result = await mutation(
        null,
        { input: { productId: 'prod-1', rating: 5, userId: spoofedUserId } },
        { currentUser: makeUser({ userId: jwtUserId }) },
      );

      // The review was created with the JWT userId, not the spoofed one
      expect(prisma.productReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: jwtUserId }),
        }),
      );
      expect(result.userId).toBe(jwtUserId);
    });

    it('throws UNAUTHENTICATED when currentUser is null', async () => {
      const prisma = makePrismaMock();
      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'createProductReview');

      await expect(
        mutation(null, { input: { productId: 'prod-1', rating: 5 } }, { currentUser: null }),
      ).rejects.toMatchObject({
        extensions: { code: 'UNAUTHENTICATED' },
      });

      expect(prisma.productReview.create).not.toHaveBeenCalled();
    });

    it('throws UNAUTHENTICATED when context has no currentUser property', async () => {
      const prisma = makePrismaMock();
      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'createProductReview');

      await expect(
        mutation(null, { input: { productId: 'prod-1', rating: 5 } }, {}),
      ).rejects.toMatchObject({
        extensions: { code: 'UNAUTHENTICATED' },
      });
    });
  });

  // ── createReviewVote ─────────────────────────────────────────────────────────

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

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'createReviewVote');

      // Client sends only reviewId + isHelpful (userId is not in input SDL anymore)
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
      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'createReviewVote');

      await expect(
        mutation(null, { input: { reviewId: 'rev-1', isHelpful: true } }, { currentUser: null }),
      ).rejects.toMatchObject({
        extensions: { code: 'UNAUTHENTICATED' },
      });

      expect(prisma.reviewVote.upsert).not.toHaveBeenCalled();
    });

    it('throws UNAUTHENTICATED when context has no currentUser property', async () => {
      const prisma = makePrismaMock();
      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'createReviewVote');

      await expect(
        mutation(null, { input: { reviewId: 'rev-1', isHelpful: true } }, {}),
      ).rejects.toMatchObject({
        extensions: { code: 'UNAUTHENTICATED' },
      });
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

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'deleteReviewVote');

      const result = await mutation(
        null,
        { reviewId: 'rev-1' },
        { currentUser: makeUser({ userId: callerId }) },
      );

      expect(result.success).toBe(true);
      expect(prisma.reviewVote.delete).toHaveBeenCalledWith({
        where: { reviewId_userId: { reviewId: 'rev-1', userId: callerId } },
      });
    });

    it('throws NOT_FOUND (anti-enumeration) when vote belongs to another user', async () => {
      const prisma = makePrismaMock();
      // Vote exists but belongs to victim-user, NOT the caller
      // findUnique returns null because we query by caller's userId
      prisma.reviewVote.findUnique.mockResolvedValue(null);

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'deleteReviewVote');

      await expect(
        mutation(
          null,
          { reviewId: 'rev-1' },
          { currentUser: makeUser({ userId: 'attacker-user-2' }) },
        ),
      ).rejects.toMatchObject({
        extensions: { code: 'NOT_FOUND' },
      });

      // Delete must never be called when vote not found for caller
      expect(prisma.reviewVote.delete).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND when vote does not exist at all', async () => {
      const prisma = makePrismaMock();
      prisma.reviewVote.findUnique.mockResolvedValue(null);

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'deleteReviewVote');

      await expect(
        mutation(
          null,
          { reviewId: 'nonexistent-rev' },
          { currentUser: makeUser() },
        ),
      ).rejects.toMatchObject({
        extensions: { code: 'NOT_FOUND' },
      });

      expect(prisma.reviewVote.delete).not.toHaveBeenCalled();
    });

    it('throws UNAUTHENTICATED when currentUser is null', async () => {
      const prisma = makePrismaMock();
      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'deleteReviewVote');

      await expect(
        mutation(null, { reviewId: 'rev-1' }, { currentUser: null }),
      ).rejects.toMatchObject({
        extensions: { code: 'UNAUTHENTICATED' },
      });

      expect(prisma.reviewVote.findUnique).not.toHaveBeenCalled();
      expect(prisma.reviewVote.delete).not.toHaveBeenCalled();
    });

    it('throws UNAUTHENTICATED when context has no currentUser property', async () => {
      const prisma = makePrismaMock();
      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'deleteReviewVote');

      await expect(
        mutation(null, { reviewId: 'rev-1' }, {}),
      ).rejects.toMatchObject({
        extensions: { code: 'UNAUTHENTICATED' },
      });
    });

    it('admin user receives NOT_FOUND when no vote exists for their own userId', async () => {
      // Admin deleteReviewVote is scoped to their own votes.
      // Deleting arbitrary votes by userId requires a separate admin-scoped mutation.
      const prisma = makePrismaMock();
      prisma.reviewVote.findUnique.mockResolvedValue(null);

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'deleteReviewVote');

      await expect(
        mutation(null, { reviewId: 'rev-1' }, { currentUser: makeAdminUser() }),
      ).rejects.toMatchObject({
        extensions: { code: 'NOT_FOUND' },
      });

      expect(prisma.reviewVote.delete).not.toHaveBeenCalled();
    });
  });
});
