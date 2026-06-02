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

import { DeleteProductUseCase } from '../DeleteProductUseCase';
import { IProductRepository } from '../../../domain/repositories/IProductRepository';
import { ProductEntity } from '../../../domain/entities/Product';
import { NotFoundError, ValidationError } from '../../../domain/errors/DomainError';
import type { TokenPayload } from '@hbs/auth';

// ── Factories ──────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<any> = {}): ProductEntity {
  return new ProductEntity(
    overrides.id ?? 'prod-1',
    overrides.categoryId ?? 'cat-1',
    overrides.name ?? 'Test Product',
    overrides.description ?? 'A test product',
    overrides.price ?? 100,
    overrides.salePrice ?? undefined,
    overrides.sku ?? 'SKU-001',
    overrides.images ?? [],
    overrides.attributes ?? {},
    overrides.isActive ?? true,
    overrides.stockQuantity ?? 10,
    overrides.tags ?? [],
    overrides.rating ?? 0,
    overrides.reviewCount ?? 0,
    overrides.createdAt ?? new Date('2024-01-01'),
    overrides.updatedAt ?? new Date('2024-01-01'),
    overrides.variants ?? [],
  );
}

function makeUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: overrides.userId ?? 'user-1',
    email: overrides.email ?? 'admin@test.com',
    role: overrides.role ?? ('admin' as any),
    groups: overrides.groups ?? ['administrators'],
    permissions: overrides.permissions ?? ['products:write'],
  };
}

function makeRepo(overrides: Partial<IProductRepository> = {}): jest.Mocked<IProductRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdUnrestricted: jest.fn(),
    ensureWritable: jest.fn().mockResolvedValue(undefined),
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
    ...overrides,
  } as jest.Mocked<IProductRepository>;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('DeleteProductUseCase', () => {
  describe('happy path', () => {
    it('deletes the product and passes currentUser to repo when record rule allows', async () => {
      const existing = makeProduct();
      const repo = makeRepo({
        findByIdUnrestricted: jest.fn().mockResolvedValue(existing),
        delete: jest.fn().mockResolvedValue(undefined),
      });
      const useCase = new DeleteProductUseCase(repo);
      const currentUser = makeUser();

      await useCase.execute('prod-1', currentUser);

      expect(repo.findByIdUnrestricted).toHaveBeenCalledWith('prod-1');
      expect(repo.delete).toHaveBeenCalledWith('prod-1', currentUser);
    });

    it('calls repo.delete with null when no currentUser provided (fail-open)', async () => {
      const existing = makeProduct();
      const repo = makeRepo({
        findByIdUnrestricted: jest.fn().mockResolvedValue(existing),
        delete: jest.fn().mockResolvedValue(undefined),
      });
      const useCase = new DeleteProductUseCase(repo);

      await useCase.execute('prod-1');

      expect(repo.delete).toHaveBeenCalledWith('prod-1', null);
    });
  });

  describe('record rule enforcement (DENY)', () => {
    it('propagates NotFoundError thrown by repo.delete (DENY semantics from assertWriteAccess)', async () => {
      const existing = makeProduct();
      const repo = makeRepo({
        findByIdUnrestricted: jest.fn().mockResolvedValue(existing),
        // Simulate assertWriteAccess inside repo throwing NotFoundError (record rule denied)
        delete: jest.fn().mockRejectedValue(new NotFoundError('Product', 'prod-1')),
      });
      const useCase = new DeleteProductUseCase(repo);
      const currentUser = makeUser({ groups: ['sales-user'] });

      await expect(useCase.execute('prod-1', currentUser)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('validation and not-found errors', () => {
    it('throws ValidationError when id is empty', async () => {
      const repo = makeRepo();
      const useCase = new DeleteProductUseCase(repo);

      await expect(useCase.execute('')).rejects.toBeInstanceOf(ValidationError);
      expect(repo.findByIdUnrestricted).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when product does not exist in unrestricted lookup', async () => {
      const repo = makeRepo({
        findByIdUnrestricted: jest.fn().mockResolvedValue(null),
      });
      const useCase = new DeleteProductUseCase(repo);

      await expect(useCase.execute('nonexistent')).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
