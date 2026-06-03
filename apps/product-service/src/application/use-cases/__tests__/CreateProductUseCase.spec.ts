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

import { CreateProductUseCase, CreateProductRequest } from '../CreateProductUseCase';
import { IProductRepository } from '../../../domain/repositories/IProductRepository';
import { ProductEntity } from '../../../domain/entities/Product';
import {
  ValidationError,
  DuplicateError,
} from '../../../domain/errors/DomainError';

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

function makeRepo(overrides: Partial<IProductRepository> = {}): jest.Mocked<IProductRepository> {
  return {
    create: jest.fn().mockResolvedValue(makeProduct()),
    findById: jest.fn(),
    findByIdUnrestricted: jest.fn(),
    ensureWritable: jest.fn().mockResolvedValue(undefined),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findByCategory: jest.fn(),
    findBySku: jest.fn().mockResolvedValue(null),
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

const validRequest: CreateProductRequest = {
  categoryId: 'cat-1',
  name: 'Test Product',
  description: 'A test product',
  price: 100,
  sku: 'SKU-001',
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CreateProductUseCase', () => {
  describe('happy path', () => {
    it('creates and returns a product entity when all inputs are valid', async () => {
      const created = makeProduct();
      const repo = makeRepo({ create: jest.fn().mockResolvedValue(created) });
      const useCase = new CreateProductUseCase(repo);

      const result = await useCase.execute(validRequest);

      expect(result.id).toBeDefined();
      expect(repo.create).toHaveBeenCalledTimes(1);
      expect(repo.findBySku).toHaveBeenCalledWith('SKU-001');
    });

    it('normalizes SKU to uppercase and trims name', async () => {
      const repo = makeRepo();
      const useCase = new CreateProductUseCase(repo);

      await useCase.execute({ ...validRequest, sku: 'sku-lower', name: '  Padded  ' });

      const entityArg = (repo.create as jest.Mock).mock.calls[0][0] as ProductEntity;
      expect(entityArg.sku).toBe('SKU-LOWER');
      expect(entityArg.name).toBe('Padded');
    });

    it('creates product with optional fields when provided', async () => {
      const repo = makeRepo();
      const useCase = new CreateProductUseCase(repo);

      await useCase.execute({
        ...validRequest,
        salePrice: 80,
        stockQuantity: 50,
        tags: ['baby', 'toy'],
        images: ['https://img.example.com/1.jpg'],
      });

      const entityArg = (repo.create as jest.Mock).mock.calls[0][0] as ProductEntity;
      expect(entityArg.salePrice).toBe(80);
      expect(entityArg.stockQuantity).toBe(50);
    });
  });

  describe('taxAffectation', () => {
    it('defaults taxAffectation to gravado when not provided', async () => {
      const repo = makeRepo();
      const useCase = new CreateProductUseCase(repo);

      await useCase.execute(validRequest);

      const entityArg = (repo.create as jest.Mock).mock.calls[0][0] as ProductEntity;
      expect(entityArg.taxAffectation).toBe('gravado');
    });

    it('persists exonerado when explicitly provided', async () => {
      const repo = makeRepo();
      const useCase = new CreateProductUseCase(repo);

      await useCase.execute({ ...validRequest, taxAffectation: 'exonerado' });

      const entityArg = (repo.create as jest.Mock).mock.calls[0][0] as ProductEntity;
      expect(entityArg.taxAffectation).toBe('exonerado');
    });

    it('persists inafecto when explicitly provided', async () => {
      const repo = makeRepo();
      const useCase = new CreateProductUseCase(repo);

      await useCase.execute({ ...validRequest, taxAffectation: 'inafecto' });

      const entityArg = (repo.create as jest.Mock).mock.calls[0][0] as ProductEntity;
      expect(entityArg.taxAffectation).toBe('inafecto');
    });
  });

  describe('duplicate SKU', () => {
    it('throws DuplicateError when SKU is already taken', async () => {
      const existing = makeProduct({ sku: 'SKU-001' });
      const repo = makeRepo({ findBySku: jest.fn().mockResolvedValue(existing) });
      const useCase = new CreateProductUseCase(repo);

      await expect(useCase.execute(validRequest)).rejects.toBeInstanceOf(DuplicateError);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('validation errors', () => {
    it('throws ValidationError when categoryId is missing', async () => {
      const repo = makeRepo();
      const useCase = new CreateProductUseCase(repo);

      await expect(
        useCase.execute({ ...validRequest, categoryId: '' }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws ValidationError when name is missing', async () => {
      const repo = makeRepo();
      const useCase = new CreateProductUseCase(repo);

      await expect(
        useCase.execute({ ...validRequest, name: '   ' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when price is below minimum (< 0.01)', async () => {
      const repo = makeRepo();
      const useCase = new CreateProductUseCase(repo);

      await expect(
        useCase.execute({ ...validRequest, price: 0 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when salePrice >= price', async () => {
      const repo = makeRepo();
      const useCase = new CreateProductUseCase(repo);

      await expect(
        useCase.execute({ ...validRequest, price: 100, salePrice: 100 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when salePrice > price', async () => {
      const repo = makeRepo();
      const useCase = new CreateProductUseCase(repo);

      await expect(
        useCase.execute({ ...validRequest, price: 100, salePrice: 150 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when stockQuantity is negative', async () => {
      const repo = makeRepo();
      const useCase = new CreateProductUseCase(repo);

      await expect(
        useCase.execute({ ...validRequest, stockQuantity: -1 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when SKU is empty', async () => {
      const repo = makeRepo();
      const useCase = new CreateProductUseCase(repo);

      await expect(
        useCase.execute({ ...validRequest, sku: '' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
