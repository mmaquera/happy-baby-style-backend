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

import { DeleteCategoryUseCase } from '../DeleteCategoryUseCase';
import { NotFoundError } from '../../../domain/errors/DomainError';
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
    update: jest.fn().mockResolvedValue(makeCategory({ isActive: false })),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as any;

describe('DeleteCategoryUseCase — soft-delete (forceDelete=false)', () => {
  it('happy path — soft-deletes category via repo.update', async () => {
    const repo = makeRepo();
    const uc = new DeleteCategoryUseCase(repo);

    const result = await uc.execute({ id: 'cat-1', forceDelete: false, currentUser: makeUser() });

    expect(result.softDelete).toBe(true);
    expect(repo.update).toHaveBeenCalledWith('cat-1', { isActive: false }, expect.anything());
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when category does not exist', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new DeleteCategoryUseCase(repo);

    await expect(
      uc.execute({ id: 'cat-missing', currentUser: makeUser() }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('forwards currentUser to repo.update in soft-delete path', async () => {
    const repo = makeRepo();
    const uc = new DeleteCategoryUseCase(repo);
    const user = makeUser({ userId: 'u-soft' });

    await uc.execute({ id: 'cat-1', forceDelete: false, currentUser: user });

    expect(repo.update).toHaveBeenCalledWith('cat-1', { isActive: false }, user);
  });

  it('forwards null currentUser when not provided', async () => {
    const repo = makeRepo();
    const uc = new DeleteCategoryUseCase(repo);

    await uc.execute({ id: 'cat-1', forceDelete: false });

    expect(repo.update).toHaveBeenCalledWith('cat-1', { isActive: false }, null);
  });

  it('repo.update throws NotFoundError (DENY_WHERE) — propagates to caller', async () => {
    const repo = makeRepo({
      update: jest.fn().mockRejectedValue(new NotFoundError('Category', 'cat-1')),
    });
    const uc = new DeleteCategoryUseCase(repo);

    await expect(
      uc.execute({ id: 'cat-1', forceDelete: false, currentUser: makeUser() }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('DeleteCategoryUseCase — hard-delete (forceDelete=true)', () => {
  it('happy path — hard-deletes category via repo.delete', async () => {
    const repo = makeRepo();
    const uc = new DeleteCategoryUseCase(repo);

    const result = await uc.execute({ id: 'cat-1', forceDelete: true, currentUser: makeUser() });

    expect(result.softDelete).toBe(false);
    expect(repo.delete).toHaveBeenCalledWith('cat-1', expect.anything());
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('forwards currentUser to repo.delete in hard-delete path', async () => {
    const repo = makeRepo();
    const uc = new DeleteCategoryUseCase(repo);
    const user = makeUser({ userId: 'u-hard' });

    await uc.execute({ id: 'cat-1', forceDelete: true, currentUser: user });

    expect(repo.delete).toHaveBeenCalledWith('cat-1', user);
  });

  it('forwards null currentUser when not provided on hard-delete', async () => {
    const repo = makeRepo();
    const uc = new DeleteCategoryUseCase(repo);

    await uc.execute({ id: 'cat-1', forceDelete: true });

    expect(repo.delete).toHaveBeenCalledWith('cat-1', null);
  });

  it('repo.delete throws NotFoundError (DENY_WHERE) — propagates to caller', async () => {
    const repo = makeRepo({
      delete: jest.fn().mockRejectedValue(new NotFoundError('Category', 'cat-1')),
    });
    const uc = new DeleteCategoryUseCase(repo);

    await expect(
      uc.execute({ id: 'cat-1', forceDelete: true, currentUser: makeUser() }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
