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

import { CreateCategoryUseCase } from '../CreateCategoryUseCase';
import { DuplicateError } from '../../../domain/errors/DomainError';
import type { ICategoryRepository } from '../../../domain/repositories/ICategoryRepository';
import type { CategoryEntity } from '../../../domain/entities/Category';

const makeCategory = (name = 'Ropa Bebé'): CategoryEntity =>
  ({
    id: 'cat-1',
    name,
    slug: 'ropa-bebe',
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

const makeRepo = (overrides: Partial<jest.Mocked<ICategoryRepository>> = {}): jest.Mocked<ICategoryRepository> =>
  ({
    findByName: jest.fn().mockResolvedValue(null),
    findBySlug: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(makeCategory()),
    ...overrides,
  } as any);

describe('CreateCategoryUseCase', () => {
  it('throws RequiredFieldError when name is empty', async () => {
    const uc = new CreateCategoryUseCase(makeRepo());
    await expect(uc.execute({ name: '' })).rejects.toThrow();
  });

  it('throws when a category with the same name already exists', async () => {
    const uc = new CreateCategoryUseCase(makeRepo({ findByName: jest.fn().mockResolvedValue(makeCategory()) }));
    await expect(uc.execute({ name: 'Ropa Bebé' })).rejects.toBeInstanceOf(DuplicateError);
  });

  it('throws when a category with the same slug already exists', async () => {
    const uc = new CreateCategoryUseCase(
      makeRepo({ findBySlug: jest.fn().mockResolvedValue(makeCategory()) }),
    );
    await expect(uc.execute({ name: 'Ropa Bebé' })).rejects.toBeInstanceOf(DuplicateError);
  });

  it('creates the category and auto-generates a slug from the name', async () => {
    const repo = makeRepo();
    const uc = new CreateCategoryUseCase(repo);

    const result = await uc.execute({ name: 'Ropa Bebé' });

    expect(result.id).toBe('cat-1');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ropa Bebé', slug: 'ropa-beb' }),
    );
  });

  it('uses the provided slug instead of auto-generating one', async () => {
    const repo = makeRepo();
    const uc = new CreateCategoryUseCase(repo);

    await uc.execute({ name: 'Ropa Bebé', slug: 'custom-slug' });

    expect(repo.findBySlug).toHaveBeenCalledWith('custom-slug');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'custom-slug' }));
  });
});
