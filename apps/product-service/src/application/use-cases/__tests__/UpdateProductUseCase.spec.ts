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

import { UpdateProductUseCase, UpdateProductRequest } from '../UpdateProductUseCase';
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
    overrides.taxAffectation ?? 'gravado',
    overrides.createdAt ?? new Date('2024-01-01'),
    overrides.updatedAt ?? new Date('2024-01-01'),
    overrides.variants ?? [],
  );
}

function makeUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: overrides.userId ?? 'user-1',
    email: overrides.email ?? 'admin@test.com',
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
    findLowStock: jest.fn(),
    findOutOfStock: jest.fn(),
    createVariant: jest.fn(),
    getProductVariants: jest.fn(),
    findVariantById: jest.fn(),
    updateVariant: jest.fn(),
    deleteVariant: jest.fn(),
    ...overrides,
  } as jest.Mocked<IProductRepository>;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('UpdateProductUseCase', () => {
  describe('happy path', () => {
    it('updates the product and returns the updated entity when record rule allows', async () => {
      const existing = makeProduct();
      const updated = makeProduct({ name: 'Updated Name', updatedAt: new Date('2024-06-01') });
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(existing),
        findBySku: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(updated),
      });
      const useCase = new UpdateProductUseCase(repo);
      const currentUser = makeUser();

      const request: UpdateProductRequest = {
        id: 'prod-1',
        name: 'Updated Name',
        currentUser,
      };

      const result = await useCase.execute(request);

      expect(result.name).toBe('Updated Name');
      expect(repo.update).toHaveBeenCalledWith('prod-1', expect.objectContaining({ name: 'Updated Name' }), currentUser);
    });

    it('updates taxAffectation to exonerado', async () => {
      const existing = makeProduct({ taxAffectation: 'gravado' });
      const updated = makeProduct({ taxAffectation: 'exonerado' });
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(existing),
        findBySku: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(updated),
      });
      const useCase = new UpdateProductUseCase(repo);
      const currentUser = makeUser();

      const result = await useCase.execute({ id: 'prod-1', taxAffectation: 'exonerado', currentUser });

      expect(result.taxAffectation).toBe('exonerado');
      expect(repo.update).toHaveBeenCalledWith(
        'prod-1',
        expect.objectContaining({ taxAffectation: 'exonerado' }),
        currentUser,
      );
    });

    it('updates taxAffectation to inafecto', async () => {
      const existing = makeProduct({ taxAffectation: 'gravado' });
      const updated = makeProduct({ taxAffectation: 'inafecto' });
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(existing),
        findBySku: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(updated),
      });
      const useCase = new UpdateProductUseCase(repo);

      const result = await useCase.execute({ id: 'prod-1', taxAffectation: 'inafecto' });

      expect(result.taxAffectation).toBe('inafecto');
    });

    it('preserves existing taxAffectation when not provided in update', async () => {
      const existing = makeProduct({ taxAffectation: 'exonerado' });
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(existing),
        findBySku: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(existing),
      });
      const useCase = new UpdateProductUseCase(repo);

      await useCase.execute({ id: 'prod-1', name: 'New Name' });

      expect(repo.update).toHaveBeenCalledWith(
        'prod-1',
        expect.not.objectContaining({ taxAffectation: expect.anything() }),
        null,
      );
    });

    it('does NOT pass taxAffectation=null to repo (null treated as "no update" to prevent NOT NULL crash)', async () => {
      // Regression test for bug: SDL UpdateProductInput.taxAffectation is nullable,
      // so a client can send null. Previously null passed through the !== undefined guard
      // and reached the NOT NULL DB column → opaque Prisma crash instead of typed DomainError.
      // Fix: use != null so both null and undefined are treated as "skip".
      const existing = makeProduct({ taxAffectation: 'exonerado' });
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(existing),
        findBySku: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(existing),
      });
      const useCase = new UpdateProductUseCase(repo);

      // Explicitly pass null — client sends { taxAffectation: null } to clear the field.
      await useCase.execute({ id: 'prod-1', taxAffectation: null as any });

      expect(repo.update).toHaveBeenCalledWith(
        'prod-1',
        expect.not.objectContaining({ taxAffectation: expect.anything() }),
        null,
      );
    });

    it('passes currentUser=null when not provided (fail-open, no resolver wired)', async () => {
      const existing = makeProduct();
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(existing),
        findBySku: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(existing),
      });
      const useCase = new UpdateProductUseCase(repo);

      await useCase.execute({ id: 'prod-1', name: 'Name' });

      expect(repo.update).toHaveBeenCalledWith('prod-1', expect.any(Object), null);
    });
  });

  describe('record rule enforcement (DENY)', () => {
    it('throws NotFoundError from ensureWritable BEFORE SKU check — prevents existence leak', async () => {
      // ensureWritable fires first; SKU validation never runs.
      // This means a denied user cannot probe for SKU conflicts to confirm existence.
      const repo = makeRepo({
        ensureWritable: jest.fn().mockRejectedValue(new NotFoundError('Product', 'prod-1')),
        findById: jest.fn(),        // should NOT be called
        findBySku: jest.fn(),       // should NOT be called
        update: jest.fn(),          // should NOT be called
      });
      const useCase = new UpdateProductUseCase(repo);
      const currentUser = makeUser({ groups: ['sales-user'] });

      await expect(
        useCase.execute({ id: 'prod-1', name: 'Blocked', sku: 'TAKEN-SKU', currentUser }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(repo.findById).not.toHaveBeenCalled();
      expect(repo.findBySku).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('propagates NotFoundError thrown by repo.update (defence-in-depth: inner assertWriteAccess)', async () => {
      const existing = makeProduct();
      const repo = makeRepo({
        ensureWritable: jest.fn().mockResolvedValue(undefined),
        findById: jest.fn().mockResolvedValue(existing),
        findBySku: jest.fn().mockResolvedValue(null),
        // Simulate assertWriteAccess inside repo throwing NotFoundError (inner guard)
        update: jest.fn().mockRejectedValue(new NotFoundError('Product', 'prod-1')),
      });
      const useCase = new UpdateProductUseCase(repo);
      const currentUser = makeUser({ groups: ['sales-user'] });

      await expect(
        useCase.execute({ id: 'prod-1', name: 'Blocked', currentUser }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('validation errors', () => {
    it('throws ValidationError when id is missing', async () => {
      const repo = makeRepo();
      const useCase = new UpdateProductUseCase(repo);

      await expect(useCase.execute({ id: '', name: 'X' })).rejects.toBeInstanceOf(ValidationError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when product does not exist', async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(null),
      });
      const useCase = new UpdateProductUseCase(repo);

      await expect(useCase.execute({ id: 'nonexistent', name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ValidationError when price is negative', async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(makeProduct()),
        findBySku: jest.fn().mockResolvedValue(null),
      });
      const useCase = new UpdateProductUseCase(repo);

      await expect(useCase.execute({ id: 'prod-1', price: -1 })).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when salePrice >= price', async () => {
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(makeProduct()),
        findBySku: jest.fn().mockResolvedValue(null),
      });
      const useCase = new UpdateProductUseCase(repo);

      await expect(
        useCase.execute({ id: 'prod-1', price: 100, salePrice: 100 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when SKU is already taken by another product', async () => {
      const existing = makeProduct({ sku: 'OLD-SKU' });
      const conflicting = makeProduct({ id: 'prod-2', sku: 'NEW-SKU' });
      const repo = makeRepo({
        findById: jest.fn().mockResolvedValue(existing),
        findBySku: jest.fn().mockResolvedValue(conflicting),
      });
      const useCase = new UpdateProductUseCase(repo);

      await expect(useCase.execute({ id: 'prod-1', sku: 'NEW-SKU' })).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
