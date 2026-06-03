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

import { CreateProductReviewUseCase } from '../CreateProductReviewUseCase';
import { IProductReviewRepository } from '../../../domain/repositories/IProductReviewRepository';
import { IProductRepository } from '../../../domain/repositories/IProductRepository';
import { ProductReviewEntity } from '../../../domain/entities/ProductReview';
import { ProductEntity } from '../../../domain/entities/Product';
import {
  NotFoundError,
  DuplicateError,
  ValidationError,
} from '../../../domain/errors/DomainError';
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

function makeProduct(overrides: Partial<any> = {}): ProductEntity {
  return new ProductEntity(
    overrides.id ?? 'prod-1',
    overrides.categoryId ?? 'cat-1',
    overrides.name ?? 'Test Product',
    overrides.description ?? 'A test product',
    overrides.price ?? 100,
    undefined,
    overrides.sku ?? 'SKU-001',
    [],
    {},
    true,
    10,
    [],
    0,
    0,
    'gravado',
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    [],
  );
}

function makeReview(overrides: Partial<any> = {}): ProductReviewEntity {
  return new ProductReviewEntity(
    overrides.id ?? 'rev-1',
    overrides.productId ?? 'prod-1',
    overrides.userId ?? 'user-jwt-1',
    overrides.rating ?? 5,
    false,
    false,
    0,
    'pending',
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    overrides.title,
    overrides.comment,
  );
}

function makeReviewRepo(overrides: Partial<IProductReviewRepository> = {}): jest.Mocked<IProductReviewRepository> {
  return {
    create: jest.fn().mockResolvedValue(makeReview()),
    findById: jest.fn(),
    findByProduct: jest.fn(),
    findByUser: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    ...overrides,
  } as jest.Mocked<IProductReviewRepository>;
}

function makeProductRepo(overrides: Partial<IProductRepository> = {}): jest.Mocked<IProductRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(makeProduct()),
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
    ...overrides,
  } as jest.Mocked<IProductRepository>;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CreateProductReviewUseCase', () => {
  describe('happy path', () => {
    it('creates a review and pins author to JWT userId (BOLA prevention)', async () => {
      const jwtUser = makeUser({ userId: 'user-jwt-1' });
      const savedReview = makeReview({ userId: 'user-jwt-1' });

      const reviewRepo = makeReviewRepo({ create: jest.fn().mockResolvedValue(savedReview) });
      const productRepo = makeProductRepo();

      const useCase = new CreateProductReviewUseCase(reviewRepo, productRepo);
      const result = await useCase.execute({
        productId: 'prod-1',
        rating: 5,
        title: 'Great product',
        currentUser: jwtUser,
      });

      expect(result.userId).toBe('user-jwt-1');
      expect(reviewRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-jwt-1', productId: 'prod-1' }),
      );
    });

    it('creates a review with minimum required fields', async () => {
      const reviewRepo = makeReviewRepo();
      const productRepo = makeProductRepo();
      const useCase = new CreateProductReviewUseCase(reviewRepo, productRepo);

      const result = await useCase.execute({
        productId: 'prod-1',
        rating: 3,
        currentUser: makeUser(),
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.isApproved).toBe(false);
    });
  });

  describe('BOLA — author is always from JWT', () => {
    it('ignores any userId field on the input — author comes from currentUser.userId only', async () => {
      const jwtUserId = 'real-user-1';
      const savedReview = makeReview({ userId: jwtUserId });

      const reviewRepo = makeReviewRepo({ create: jest.fn().mockResolvedValue(savedReview) });
      const productRepo = makeProductRepo();
      const useCase = new CreateProductReviewUseCase(reviewRepo, productRepo);

      const result = await useCase.execute({
        productId: 'prod-1',
        rating: 4,
        currentUser: makeUser({ userId: jwtUserId }),
      });

      // Entity created must carry JWT userId, not any possible spoofed input
      const createCall = (reviewRepo.create as jest.Mock).mock.calls[0][0];
      expect(createCall.userId).toBe(jwtUserId);
      expect(result.userId).toBe(jwtUserId);
    });
  });

  describe('product not found', () => {
    it('throws NotFoundError when productId does not exist', async () => {
      const reviewRepo = makeReviewRepo();
      const productRepo = makeProductRepo({
        findById: jest.fn().mockResolvedValue(null),
      });
      const useCase = new CreateProductReviewUseCase(reviewRepo, productRepo);

      await expect(
        useCase.execute({ productId: 'nonexistent', rating: 5, currentUser: makeUser() }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(reviewRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('duplicate review (same user + product)', () => {
    it('throws DuplicateError when P2002 Prisma error is thrown by repository', async () => {
      const p2002Error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      const reviewRepo = makeReviewRepo({ create: jest.fn().mockRejectedValue(p2002Error) });
      const productRepo = makeProductRepo();
      const useCase = new CreateProductReviewUseCase(reviewRepo, productRepo);

      await expect(
        useCase.execute({ productId: 'prod-1', rating: 4, currentUser: makeUser() }),
      ).rejects.toBeInstanceOf(DuplicateError);
    });
  });

  describe('validation errors', () => {
    it('throws ValidationError when productId is empty', async () => {
      const useCase = new CreateProductReviewUseCase(makeReviewRepo(), makeProductRepo());
      await expect(
        useCase.execute({ productId: '', rating: 5, currentUser: makeUser() }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when rating is missing', async () => {
      const useCase = new CreateProductReviewUseCase(makeReviewRepo(), makeProductRepo());
      await expect(
        useCase.execute({ productId: 'prod-1', rating: 0, currentUser: makeUser() }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when rating is out of range (> 5)', async () => {
      const useCase = new CreateProductReviewUseCase(makeReviewRepo(), makeProductRepo());
      await expect(
        useCase.execute({ productId: 'prod-1', rating: 6, currentUser: makeUser() }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when rating is out of range (< 1)', async () => {
      const useCase = new CreateProductReviewUseCase(makeReviewRepo(), makeProductRepo());
      await expect(
        useCase.execute({ productId: 'prod-1', rating: -1, currentUser: makeUser() }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
