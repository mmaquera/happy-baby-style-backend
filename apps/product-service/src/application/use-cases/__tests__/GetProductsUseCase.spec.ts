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

import { GetProductsUseCase } from '../GetProductsUseCase';
import { IProductRepository, ProductFilters } from '../../../domain/repositories/IProductRepository';
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
    overrides.isActive ?? true,
    overrides.stockQuantity ?? 10,
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
    findAll: jest.fn().mockResolvedValue([]),
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

describe('GetProductsUseCase', () => {
  describe('happy path', () => {
    it('returns empty result when no products exist', async () => {
      const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([]) });
      const useCase = new GetProductsUseCase(repo);

      const result = await useCase.execute({});

      expect(result.products).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('returns products list with hasMore=false when fewer than limit returned', async () => {
      const products = [makeProduct({ id: 'p1' }), makeProduct({ id: 'p2' })];
      const repo = makeRepo({ findAll: jest.fn().mockResolvedValue(products) });
      const useCase = new GetProductsUseCase(repo);

      const result = await useCase.execute({ pagination: { limit: 10, offset: 0 } });

      expect(result.products).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it('returns hasMore=true when returned count equals limit', async () => {
      // Exactly `limit` products returned → there may be more
      const products = Array.from({ length: 10 }, (_, i) => makeProduct({ id: `p${i}` }));
      const repo = makeRepo({ findAll: jest.fn().mockResolvedValue(products) });
      const useCase = new GetProductsUseCase(repo);

      const result = await useCase.execute({ pagination: { limit: 10, offset: 0 } });

      expect(result.hasMore).toBe(true);
    });
  });

  describe('filters', () => {
    it('passes categoryId filter to repository', async () => {
      const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([]) });
      const useCase = new GetProductsUseCase(repo);

      await useCase.execute({ filters: { categoryId: 'cat-42' } });

      const filtersArg = (repo.findAll as jest.Mock).mock.calls[0][0] as ProductFilters;
      expect(filtersArg.categoryId).toBe('cat-42');
    });

    it('trims search term before passing to repository', async () => {
      const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([]) });
      const useCase = new GetProductsUseCase(repo);

      await useCase.execute({ filters: { search: '  baby toy  ' } });

      const filtersArg = (repo.findAll as jest.Mock).mock.calls[0][0] as ProductFilters;
      expect(filtersArg.search).toBe('baby toy');
    });

    it('passes isActive, minPrice and maxPrice filters', async () => {
      const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([]) });
      const useCase = new GetProductsUseCase(repo);

      await useCase.execute({
        filters: { isActive: true, minPrice: 10, maxPrice: 200 },
      });

      const filtersArg = (repo.findAll as jest.Mock).mock.calls[0][0] as ProductFilters;
      expect(filtersArg.isActive).toBe(true);
      expect(filtersArg.minPrice).toBe(10);
      expect(filtersArg.maxPrice).toBe(200);
    });
  });

  describe('pagination', () => {
    it('uses default limit=50 and offset=0 when not provided', async () => {
      const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([]) });
      const useCase = new GetProductsUseCase(repo);

      await useCase.execute({});

      const filtersArg = (repo.findAll as jest.Mock).mock.calls[0][0] as ProductFilters;
      expect(filtersArg.limit).toBe(50);
      expect(filtersArg.offset).toBe(0);
    });

    it('forwards provided limit and offset to repository', async () => {
      const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([]) });
      const useCase = new GetProductsUseCase(repo);

      await useCase.execute({ pagination: { limit: 20, offset: 40 } });

      const filtersArg = (repo.findAll as jest.Mock).mock.calls[0][0] as ProductFilters;
      expect(filtersArg.limit).toBe(20);
      expect(filtersArg.offset).toBe(40);
    });
  });
});
