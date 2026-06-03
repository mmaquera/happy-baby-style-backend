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

import { GetProductByIdUseCase } from '../GetProductByIdUseCase';
import { IProductRepository } from '../../../domain/repositories/IProductRepository';
import { ProductEntity } from '../../../domain/entities/Product';

// ── Factories ──────────────────────────────────────────────────────────────────

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

function makeRepo(overrides: Partial<IProductRepository> = {}): jest.Mocked<IProductRepository> {
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
    findVariantById: jest.fn(),
    updateVariant: jest.fn(),
    deleteVariant: jest.fn(),
    ...overrides,
  } as jest.Mocked<IProductRepository>;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GetProductByIdUseCase', () => {
  describe('happy path', () => {
    it('returns the product when found', async () => {
      const product = makeProduct({ id: 'prod-1', name: 'Baby Toy' });
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(product) });
      const useCase = new GetProductByIdUseCase(repo);

      const result = await useCase.execute('prod-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('prod-1');
      expect(result?.name).toBe('Baby Toy');
      expect(repo.findById).toHaveBeenCalledWith('prod-1');
    });
  });

  describe('not found', () => {
    it('returns null when product does not exist', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const useCase = new GetProductByIdUseCase(repo);

      const result = await useCase.execute('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('validation', () => {
    it('throws when id is empty', async () => {
      const repo = makeRepo();
      const useCase = new GetProductByIdUseCase(repo);

      await expect(useCase.execute('')).rejects.toThrow('Product ID is required');
      expect(repo.findById).not.toHaveBeenCalled();
    });
  });
});
