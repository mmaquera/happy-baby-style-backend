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

import { GetCategoryByIdUseCase } from '../GetCategoryByIdUseCase';
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
    findById: jest.fn().mockResolvedValue(makeCategory()),
    ...overrides,
  }) as any;

describe('GetCategoryByIdUseCase', () => {
  it('happy path — returns the category when it exists', async () => {
    const repo = makeRepo();
    const uc = new GetCategoryByIdUseCase(repo);

    const result = await uc.execute({ id: 'cat-1' });

    expect(result.id).toBe('cat-1');
    expect(result.name).toBe('Ropa');
    expect(repo.findById).toHaveBeenCalledWith('cat-1');
  });

  it('throws NotFoundError when category does not exist', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new GetCategoryByIdUseCase(repo);

    await expect(uc.execute({ id: 'missing-id' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws when id is empty', async () => {
    const repo = makeRepo();
    const uc = new GetCategoryByIdUseCase(repo);

    await expect(uc.execute({ id: '' })).rejects.toThrow();
  });

  it('returns a category with parentId populated when it has a parent', async () => {
    const childCategory = makeCategory({ id: 'cat-child', parentId: 'cat-parent' });
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(childCategory) });
    const uc = new GetCategoryByIdUseCase(repo);

    const result = await uc.execute({ id: 'cat-child' });

    expect(result.parentId).toBe('cat-parent');
  });

  it('propagates repository errors', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockRejectedValue(new Error('DB timeout')),
    });
    const uc = new GetCategoryByIdUseCase(repo);

    await expect(uc.execute({ id: 'cat-1' })).rejects.toThrow('DB timeout');
  });
});
