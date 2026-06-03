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

jest.mock(
  '@hbs/authz',
  () => ({
    isAdmin: jest.fn((user: any) => {
      if (!user) return false;
      return (user.groups ?? []).includes('administrators');
    }),
  }),
  { virtual: true },
);

import { UpdateProductReviewUseCase } from '../UpdateProductReviewUseCase';
import { DeleteProductReviewUseCase } from '../DeleteProductReviewUseCase';
import { IProductReviewRepository } from '../../../domain/repositories/IProductReviewRepository';
import { ProductReviewEntity } from '../../../domain/entities/ProductReview';
import { NotFoundError, ValidationError } from '../../../domain/errors/DomainError';
import type { TokenPayload } from '@hbs/auth';

// ── Factories ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: overrides.userId ?? 'user-1',
    email: overrides.email ?? 'user@test.com',
    groups: overrides.groups ?? ['customer'],
    permissions: overrides.permissions ?? [],
  };
}

function makeAdminUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: overrides.userId ?? 'admin-1',
    email: overrides.email ?? 'admin@test.com',
    groups: overrides.groups ?? ['administrators'],
    permissions: overrides.permissions ?? [],
  };
}

function makeReview(overrides: Partial<any> = {}): ProductReviewEntity {
  return new ProductReviewEntity(
    overrides.id ?? 'rev-1',
    overrides.productId ?? 'prod-1',
    overrides.userId ?? 'owner-user-1',
    overrides.rating ?? 4,
    false,
    false,
    0,
    overrides.status ?? 'pending',
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    overrides.title ?? 'Good product',
    overrides.comment,
  );
}

function makeRepo(overrides: Partial<IProductReviewRepository> = {}): jest.Mocked<IProductReviewRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(makeReview()),
    findByProduct: jest.fn(),
    findByUser: jest.fn(),
    update: jest.fn().mockResolvedValue(makeReview({ title: 'Updated title' })),
    delete: jest.fn().mockResolvedValue(undefined),
    approve: jest.fn(),
    reject: jest.fn(),
    ...overrides,
  } as jest.Mocked<IProductReviewRepository>;
}

// ── UpdateProductReviewUseCase tests ──────────────────────────────────────────

describe('UpdateProductReviewUseCase', () => {
  describe('happy path', () => {
    it('allows owner to update their own review', async () => {
      const ownerId = 'owner-user-1';
      const review = makeReview({ userId: ownerId });
      const updatedReview = makeReview({ userId: ownerId, title: 'Updated title' });

      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(review),
        update: jest.fn().mockResolvedValue(updatedReview),
      });
      const useCase = new UpdateProductReviewUseCase(repo);

      const result = await useCase.execute({
        id: 'rev-1',
        title: 'Updated title',
        currentUser: makeUser({ userId: ownerId }),
      });

      expect(result.title).toBe('Updated title');
      expect(repo.update).toHaveBeenCalledWith('rev-1', expect.objectContaining({ title: 'Updated title' }));
    });

    it('allows admin to update any review regardless of ownership', async () => {
      const review = makeReview({ userId: 'regular-user-1' });
      const updatedReview = makeReview({ userId: 'regular-user-1', rating: 3 });

      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(review),
        update: jest.fn().mockResolvedValue(updatedReview),
      });
      const useCase = new UpdateProductReviewUseCase(repo);

      const result = await useCase.execute({
        id: 'rev-1',
        rating: 3,
        currentUser: makeAdminUser(),
      });

      expect(result).toBeDefined();
      expect(repo.update).toHaveBeenCalled();
    });
  });

  describe('BOLA — owner enforcement', () => {
    it('throws NotFoundError (anti-enumeration) when non-owner non-admin tries to update', async () => {
      const review = makeReview({ userId: 'owner-user-1' });
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(review) });
      const useCase = new UpdateProductReviewUseCase(repo);

      await expect(
        useCase.execute({
          id: 'rev-1',
          title: 'Hacked',
          currentUser: makeUser({ userId: 'attacker-user-2', groups: ['customer'] }),
        }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when review does not exist (anti-enumeration)', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const useCase = new UpdateProductReviewUseCase(repo);

      await expect(
        useCase.execute({
          id: 'nonexistent-rev',
          title: 'Ghost',
          currentUser: makeUser(),
        }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('throws ValidationError when id is empty', async () => {
      const useCase = new UpdateProductReviewUseCase(makeRepo());
      await expect(
        useCase.execute({ id: '', title: 'X', currentUser: makeUser() }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when rating is out of range', async () => {
      const useCase = new UpdateProductReviewUseCase(makeRepo());
      await expect(
        useCase.execute({ id: 'rev-1', rating: 6, currentUser: makeUser({ userId: 'owner-user-1' }) }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when no fields are provided (no-op guard)', async () => {
      const useCase = new UpdateProductReviewUseCase(makeRepo());
      await expect(
        useCase.execute({ id: 'rev-1', currentUser: makeUser({ userId: 'owner-user-1' }) }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});

// ── DeleteProductReviewUseCase tests ──────────────────────────────────────────

describe('DeleteProductReviewUseCase', () => {
  describe('happy path', () => {
    it('allows owner to delete their own review', async () => {
      const ownerId = 'owner-user-1';
      const review = makeReview({ userId: ownerId });

      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(review),
        delete: jest.fn().mockResolvedValue(undefined),
      });
      const useCase = new DeleteProductReviewUseCase(repo);

      await useCase.execute('rev-1', makeUser({ userId: ownerId }));

      expect(repo.delete).toHaveBeenCalledWith('rev-1');
    });

    it('allows admin to delete any review', async () => {
      const review = makeReview({ userId: 'regular-user-1' });
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(review),
        delete: jest.fn().mockResolvedValue(undefined),
      });
      const useCase = new DeleteProductReviewUseCase(repo);

      await useCase.execute('rev-1', makeAdminUser());

      expect(repo.delete).toHaveBeenCalledWith('rev-1');
    });
  });

  describe('BOLA — owner enforcement', () => {
    it('throws NotFoundError (anti-enumeration) when non-owner non-admin tries to delete', async () => {
      const review = makeReview({ userId: 'owner-user-1' });
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(review) });
      const useCase = new DeleteProductReviewUseCase(repo);

      await expect(
        useCase.execute('rev-1', makeUser({ userId: 'attacker-user-2', groups: ['customer'] })),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when review does not exist (anti-enumeration)', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const useCase = new DeleteProductReviewUseCase(repo);

      await expect(
        useCase.execute('nonexistent-rev', makeUser()),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('throws ValidationError when id is empty', async () => {
      const useCase = new DeleteProductReviewUseCase(makeRepo());
      await expect(useCase.execute('', makeUser())).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
