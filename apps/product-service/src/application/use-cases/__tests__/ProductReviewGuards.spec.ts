/**
 * ProductReviewGuards.spec.ts
 *
 * Tests for the BOLA/auth security guards and Prisma FK error mapping on review mutations.
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
 *   - createProductReview: Prisma P2003 FK (productId not found) → GraphQLError NOT_FOUND (no schema leak)
 *   - createProductReview: Prisma unknown error → re-thrown (not swallowed)
 *   - createReviewVote: voter is pinned to JWT userId (not input.userId)
 *   - createReviewVote: unauthenticated caller → UNAUTHENTICATED
 *   - createReviewVote: Prisma P2003 FK (reviewId not found) → GraphQLError NOT_FOUND (no schema leak)
 *   - deleteReviewVote: ownership enforced (own vote → success)
 *   - deleteReviewVote: vote belonging to another user → NOT_FOUND (anti-enumeration)
 *   - deleteReviewVote: vote does not exist at all → NOT_FOUND
 *   - deleteReviewVote: unauthenticated caller → UNAUTHENTICATED
 *   - deleteReviewVote: admin without own vote → NOT_FOUND (same as non-admin; no scope-creep)
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

jest.mock(
  '@hbs/authz',
  () => ({
    assertModelAccess: jest.fn(),
    // isAdmin is used in updateProductReview for the owner-or-admin BOLA guard.
    isAdmin: jest.fn((user: any) => {
      if (!user) return false;
      return (user.groups ?? []).includes('administrators');
    }),
  }),
  { virtual: true },
);

import { GraphQLError } from 'graphql';
import { Prisma } from '@prisma/client';
import type { TokenPayload } from '@hbs/auth';

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

    it('maps Prisma P2003 (FK violation — productId not found) to a GraphQLError NOT_FOUND (no schema leak, correct HTTP semantics)', async () => {
      const prisma = makePrismaMock();
      // Simulate Prisma throwing P2003 when productId does not exist in the products table.
      const fkError = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
      });
      prisma.productReview.create.mockRejectedValue(fkError);

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'createProductReview');

      // Must throw a GraphQLError with NOT_FOUND so Apollo forwards the correct 404 to the client.
      // (Non-GraphQLError exceptions are masked as INTERNAL_SERVER_ERROR by Apollo Server 4.)
      await expect(
        mutation(null, { input: { productId: 'nonexistent-prod', rating: 5 } }, { currentUser: makeUser() }),
      ).rejects.toMatchObject({
        extensions: { code: 'NOT_FOUND' },
      });

      // Also assert the message is clean — no Prisma-internal details.
      const thrownError = await mutation(
        null,
        { input: { productId: 'nonexistent-prod', rating: 5 } },
        { currentUser: makeUser() },
      ).catch((e: unknown) => e);
      const msg = (thrownError as Error).message;
      expect(msg).not.toMatch(/foreign key/i);
      expect(msg).not.toMatch(/constraint/i);
      expect(msg).not.toMatch(/prisma/i);
      expect(msg.toLowerCase()).toContain('product');
    });

    it('maps Prisma P2002 (unique constraint — duplicate review) to GraphQLError CONFLICT (409), message must not expose internal details', async () => {
      const prisma = makePrismaMock();
      // Simulate Prisma throwing P2002 when the same user tries to review the same product twice.
      // This is triggered by @@unique([productId, userId]) on ProductReview.
      const uniqueError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      prisma.productReview.create.mockRejectedValue(uniqueError);

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'createProductReview');

      // Must surface as CONFLICT (not INTERNAL_SERVER_ERROR) so Apollo forwards 409.
      await expect(
        mutation(
          null,
          { input: { productId: 'prod-1', rating: 4 } },
          { currentUser: makeUser() },
        ),
      ).rejects.toMatchObject({
        extensions: { code: 'CONFLICT', http: { status: 409 } },
      });

      // Message must be user-friendly — no Prisma internals, no table/column names.
      const thrown = await mutation(
        null,
        { input: { productId: 'prod-1', rating: 4 } },
        { currentUser: makeUser() },
      ).catch((e: unknown) => e);
      const msg = (thrown as Error).message;
      expect(msg).not.toMatch(/unique constraint/i);
      expect(msg).not.toMatch(/prisma/i);
      expect(msg).not.toMatch(/product_reviews/i);
      expect(msg.toLowerCase()).toContain('already reviewed');
    });

    it('re-throws unknown non-Prisma errors without swallowing', async () => {
      const prisma = makePrismaMock();
      const unknownError = new Error('database connection lost');
      prisma.productReview.create.mockRejectedValue(unknownError);

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'createProductReview');

      await expect(
        mutation(null, { input: { productId: 'prod-1', rating: 5 } }, { currentUser: makeUser() }),
      ).rejects.toThrow('database connection lost');
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

    it('maps Prisma P2003 (FK violation — reviewId not found) to a GraphQLError NOT_FOUND (no schema leak, correct HTTP semantics)', async () => {
      const prisma = makePrismaMock();
      // Simulate Prisma throwing P2003 when reviewId does not exist in the product_reviews table.
      const fkError = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
      });
      prisma.reviewVote.upsert.mockRejectedValue(fkError);

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'createReviewVote');

      // Must throw a GraphQLError with NOT_FOUND so Apollo forwards the correct 404 to the client.
      await expect(
        mutation(null, { input: { reviewId: 'nonexistent-rev', isHelpful: true } }, { currentUser: makeUser() }),
      ).rejects.toMatchObject({
        extensions: { code: 'NOT_FOUND' },
      });

      // Also assert the message is clean — no Prisma-internal details.
      const thrownError = await mutation(
        null,
        { input: { reviewId: 'nonexistent-rev', isHelpful: true } },
        { currentUser: makeUser() },
      ).catch((e: unknown) => e);
      const msg = (thrownError as Error).message;
      expect(msg).not.toMatch(/foreign key/i);
      expect(msg).not.toMatch(/constraint/i);
      expect(msg).not.toMatch(/prisma/i);
      expect(msg.toLowerCase()).toContain('review');
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

    it('admin user receives NOT_FOUND when no vote exists for their own userId (no scope-creep: admin override requires a separate mutation with targetUserId)', async () => {
      // deleteReviewVote is ownership-only: any caller (including admin) can only delete
      // their own vote via this mutation. An admin-scoped mutation that accepts an explicit
      // targetUserId is deferred — changing this SDL-bound mutation would be scope-creep.
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

  // ── updateProductReview (BOLA fix — owner-or-admin) ─────────────────────────
  //
  // Security model:
  //   - assertModelAccess baseline: unauthenticated → 401; non-staff without
  //     update:product → 403. Handled by the mock (jest.fn()) — not re-tested here.
  //   - Owner-or-admin guard (BOLA): loads the review row, then:
  //       * owner (review.userId === callerId) → allowed
  //       * admin (isAdmin === true)           → allowed (any review)
  //       * non-owner non-admin               → NOT_FOUND (anti-enumeration)
  //       * review does not exist              → NOT_FOUND (anti-enumeration)

  describe('updateProductReview', () => {
    function makeReview(overrides: Record<string, any> = {}) {
      return {
        id: 'rev-1',
        productId: 'prod-1',
        userId: 'owner-user-1',
        rating: 4,
        title: 'Good',
        comment: null,
        isApproved: false,
        isVerified: false,
        helpfulCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        photos: [],
        votes: [],
        ...overrides,
      };
    }

    it('allows owner to edit their own review', async () => {
      const prisma = makePrismaMock();
      const ownerId = 'owner-user-1';
      const review = makeReview({ userId: ownerId });

      prisma.productReview.findUnique.mockResolvedValue(review);
      prisma.productReview.update.mockResolvedValue({ ...review, title: 'Updated title' });

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'updateProductReview');

      const result = await mutation(
        null,
        { id: 'rev-1', input: { title: 'Updated title' } },
        { currentUser: makeUser({ userId: ownerId }) },
      );

      expect(prisma.productReview.findUnique).toHaveBeenCalledWith({ where: { id: 'rev-1' } });
      expect(prisma.productReview.update).toHaveBeenCalled();
      expect(result.title).toBe('Updated title');
    });

    it('throws NOT_FOUND (anti-enumeration) when non-owner non-admin attempts edit', async () => {
      const prisma = makePrismaMock();
      // Review belongs to owner-user-1 — attacker is a different user
      const review = makeReview({ userId: 'owner-user-1' });
      prisma.productReview.findUnique.mockResolvedValue(review);

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'updateProductReview');

      await expect(
        mutation(
          null,
          { id: 'rev-1', input: { title: 'Hacked' } },
          { currentUser: makeUser({ userId: 'attacker-user-2', groups: ['sales-user'] }) },
        ),
      ).rejects.toMatchObject({
        extensions: { code: 'NOT_FOUND' },
      });

      // DB write must NOT happen
      expect(prisma.productReview.update).not.toHaveBeenCalled();
    });

    it('allows admin to edit any review regardless of ownership', async () => {
      const prisma = makePrismaMock();
      // Review belongs to a regular user — admin is editing it
      const review = makeReview({ userId: 'regular-user-1' });
      prisma.productReview.findUnique.mockResolvedValue(review);
      prisma.productReview.update.mockResolvedValue({ ...review, isApproved: true });

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'updateProductReview');

      const result = await mutation(
        null,
        { id: 'rev-1', input: { isApproved: true } },
        { currentUser: makeAdminUser() },
      );

      expect(prisma.productReview.update).toHaveBeenCalled();
      expect(result.isApproved).toBe(true);
    });

    it('throws NOT_FOUND (anti-enumeration) when review does not exist', async () => {
      const prisma = makePrismaMock();
      prisma.productReview.findUnique.mockResolvedValue(null);

      const resolvers = createResolvers(makeRepoMock(), prisma as any);
      const mutation = getMutation(resolvers, 'updateProductReview');

      await expect(
        mutation(
          null,
          { id: 'nonexistent-rev', input: { title: 'Ghost' } },
          { currentUser: makeUser() },
        ),
      ).rejects.toMatchObject({
        extensions: { code: 'NOT_FOUND' },
      });

      expect(prisma.productReview.update).not.toHaveBeenCalled();
    });
  });
});
