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

import { GetCategoryBySlugUseCase } from '../GetCategoryBySlugUseCase';
import { NotFoundError } from '../../../domain/errors/DomainError';
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
    findBySlug: jest.fn().mockResolvedValue(makeCategory()),
    ...overrides,
  }) as any;

describe('GetCategoryBySlugUseCase', () => {
  it('happy path — returns the category matching the slug', async () => {
    const repo = makeRepo();
    const uc = new GetCategoryBySlugUseCase(repo);

    const result = await uc.execute({ slug: 'ropa' });

    expect(result.slug).toBe('ropa');
    expect(repo.findBySlug).toHaveBeenCalledWith('ropa');
  });

  it('throws NotFoundError when no category matches the slug', async () => {
    const repo = makeRepo({ findBySlug: jest.fn().mockResolvedValue(null) });
    const uc = new GetCategoryBySlugUseCase(repo);

    await expect(uc.execute({ slug: 'non-existent' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws when slug is empty', async () => {
    const repo = makeRepo();
    const uc = new GetCategoryBySlugUseCase(repo);

    await expect(uc.execute({ slug: '' })).rejects.toThrow();
  });

  it('returns a category with parentId populated when it has a parent', async () => {
    const childCategory = makeCategory({ slug: 'ropa-ninos', parentId: 'cat-parent' });
    const repo = makeRepo({ findBySlug: jest.fn().mockResolvedValue(childCategory) });
    const uc = new GetCategoryBySlugUseCase(repo);

    const result = await uc.execute({ slug: 'ropa-ninos' });

    expect(result.parentId).toBe('cat-parent');
  });

  it('propagates repository errors', async () => {
    const repo = makeRepo({
      findBySlug: jest.fn().mockRejectedValue(new Error('DB timeout')),
    });
    const uc = new GetCategoryBySlugUseCase(repo);

    await expect(uc.execute({ slug: 'ropa' })).rejects.toThrow('DB timeout');
  });
});
