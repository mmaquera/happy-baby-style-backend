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

import { GetCategoriesUseCase } from '../GetCategoriesUseCase';
import type { ICategoryRepository } from '../../../domain/repositories/ICategoryRepository';
import type { CategoryEntity } from '../../../domain/entities/Category';

const makeCategory = (overrides: Partial<CategoryEntity> = {}): CategoryEntity =>
  ({
    id: 'cat-1',
    name: 'Ropa',
    slug: 'ropa',
    description: undefined,
    imageUrl: undefined,
    isActive: true,
    sortOrder: 0,
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as CategoryEntity;

const makeRepo = (
  overrides: Partial<jest.Mocked<ICategoryRepository>> = {},
): jest.Mocked<ICategoryRepository> =>
  ({
    findAll: jest.fn().mockResolvedValue([makeCategory(), makeCategory({ id: 'cat-2', name: 'Juguetes' })]),
    ...overrides,
  }) as any;

describe('GetCategoriesUseCase', () => {
  it('happy path — returns categories with pagination metadata', async () => {
    const repo = makeRepo();
    const uc = new GetCategoriesUseCase(repo);

    const result = await uc.execute({ pagination: { limit: 10, offset: 0 } });

    expect(result.categories).toHaveLength(2);
    expect(result.total).toBeGreaterThan(0);
    expect(typeof result.hasMore).toBe('boolean');
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 0 }),
    );
  });

  it('applies isActive filter when provided', async () => {
    const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([makeCategory()]) });
    const uc = new GetCategoriesUseCase(repo);

    await uc.execute({ filters: { isActive: true } });

    expect(repo.findAll).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });

  it('applies search filter when provided', async () => {
    const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([makeCategory()]) });
    const uc = new GetCategoriesUseCase(repo);

    await uc.execute({ filters: { search: '  ropa  ' } });

    // Trims the search term before passing to the repo
    expect(repo.findAll).toHaveBeenCalledWith(expect.objectContaining({ search: 'ropa' }));
  });

  it('returns empty list without error when no categories exist', async () => {
    const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([]) });
    const uc = new GetCategoriesUseCase(repo);

    const result = await uc.execute();

    expect(result.categories).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it('uses default pagination (limit=50, offset=0) when none provided', async () => {
    const repo = makeRepo({ findAll: jest.fn().mockResolvedValue([]) });
    const uc = new GetCategoriesUseCase(repo);

    await uc.execute();

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 }),
    );
  });

  it('hasMore is true when result count equals limit', async () => {
    const fiveItems = Array.from({ length: 5 }, (_, i) =>
      makeCategory({ id: `cat-${i}`, name: `Cat ${i}` }),
    );
    const repo = makeRepo({ findAll: jest.fn().mockResolvedValue(fiveItems) });
    const uc = new GetCategoriesUseCase(repo);

    const result = await uc.execute({ pagination: { limit: 5, offset: 0 } });

    expect(result.hasMore).toBe(true);
  });

  it('propagates repository errors', async () => {
    const repo = makeRepo({ findAll: jest.fn().mockRejectedValue(new Error('DB connection lost')) });
    const uc = new GetCategoriesUseCase(repo);

    await expect(uc.execute()).rejects.toThrow('DB connection lost');
  });
});
