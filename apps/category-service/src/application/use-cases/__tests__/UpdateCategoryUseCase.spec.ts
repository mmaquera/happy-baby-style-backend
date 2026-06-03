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

import { UpdateCategoryUseCase } from '../UpdateCategoryUseCase';
import { NotFoundError, DuplicateError } from '../../../domain/errors/DomainError';
import type { ICategoryRepository } from '../../../domain/repositories/ICategoryRepository';
import type { CategoryEntity } from '../../../domain/entities/Category';
import type { TokenPayload } from '@hbs/auth';

const makeCategory = (overrides: Partial<CategoryEntity> = {}): CategoryEntity =>
  ({
    id: 'cat-1',
    name: 'Ropa',
    slug: 'ropa',
    description: null,
    imageUrl: null,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as CategoryEntity;

const makeUser = (overrides: Partial<TokenPayload> = {}): TokenPayload => ({
  userId: 'user-1',
  email: 'admin@test.com',
  groups: ['administrators'],
  permissions: ['categories:write'],
  ...overrides,
});

const makeRepo = (
  overrides: Partial<jest.Mocked<ICategoryRepository>> = {},
): jest.Mocked<ICategoryRepository> =>
  ({
    findById: jest.fn().mockResolvedValue(makeCategory()),
    findByName: jest.fn().mockResolvedValue(null),
    findBySlug: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(makeCategory({ name: 'Nueva Ropa' })),
    ...overrides,
  }) as any;

describe('UpdateCategoryUseCase', () => {
  it('happy path — updates category and returns result', async () => {
    const repo = makeRepo();
    const uc = new UpdateCategoryUseCase(repo);
    const user = makeUser();

    const result = await uc.execute({ id: 'cat-1', name: 'Nueva Ropa', currentUser: user });

    expect(result.entity).toBeDefined();
    expect(result.changes).toContain('name');
  });

  it('throws NotFoundError when category does not exist', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new UpdateCategoryUseCase(repo);

    await expect(
      uc.execute({ id: 'cat-missing', name: 'X', currentUser: makeUser() }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws DuplicateError when the target name is already taken by another category', async () => {
    const repo = makeRepo({
      findByName: jest.fn().mockResolvedValue(makeCategory({ id: 'cat-other', name: 'Tomada' })),
    });
    const uc = new UpdateCategoryUseCase(repo);

    await expect(
      uc.execute({ id: 'cat-1', name: 'Tomada', currentUser: makeUser() }),
    ).rejects.toBeInstanceOf(DuplicateError);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('forwards currentUser to the repository update call', async () => {
    const repo = makeRepo();
    const uc = new UpdateCategoryUseCase(repo);
    const user = makeUser({ userId: 'u-forwarded' });

    await uc.execute({ id: 'cat-1', name: 'Nueva Ropa', currentUser: user });

    expect(repo.update).toHaveBeenCalledWith('cat-1', expect.any(Object), user);
  });

  it('forwards null currentUser when not provided', async () => {
    const repo = makeRepo();
    const uc = new UpdateCategoryUseCase(repo);

    await uc.execute({ id: 'cat-1', name: 'Nueva Ropa' });

    expect(repo.update).toHaveBeenCalledWith('cat-1', expect.any(Object), null);
  });

  it('repo.update throws NotFoundError (DENY_WHERE) — propagates to caller', async () => {
    const repo = makeRepo({
      update: jest.fn().mockRejectedValue(new NotFoundError('Category', 'cat-1')),
    });
    const uc = new UpdateCategoryUseCase(repo);

    await expect(
      uc.execute({ id: 'cat-1', name: 'Nueva Ropa', currentUser: makeUser() }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns no-op result when no fields changed', async () => {
    const category = makeCategory();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(category) });
    const uc = new UpdateCategoryUseCase(repo);

    const result = await uc.execute({ id: 'cat-1', name: category.name, currentUser: makeUser() });

    expect(result.changes).toHaveLength(0);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
