/**
 * Hierarchy validation tests — parent existence and cycle detection
 * for CreateCategoryUseCase and UpdateCategoryUseCase.
 */
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
import { UpdateCategoryUseCase } from '../UpdateCategoryUseCase';
import {
  NotFoundError,
  ValidationError,
} from '../../../domain/errors/DomainError';
import type { ICategoryRepository } from '../../../domain/repositories/ICategoryRepository';
import type { CategoryEntity } from '../../../domain/entities/Category';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

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

const makeUser = (overrides: Partial<TokenPayload> = {}): TokenPayload => ({
  userId: 'user-1',
  email: 'admin@test.com',
  groups: ['administrators'],
  permissions: ['categories:write'],
  ...overrides,
});

/** Builds a repo mock with sensible hierarchy stubs. */
const makeRepo = (
  overrides: Partial<jest.Mocked<ICategoryRepository>> = {},
): jest.Mocked<ICategoryRepository> =>
  ({
    findById: jest.fn().mockResolvedValue(makeCategory()),
    findByName: jest.fn().mockResolvedValue(null),
    findBySlug: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(async (cat: CategoryEntity) => cat),
    update: jest.fn().mockImplementation(async (_id: string, data: any) =>
      makeCategory({ ...data, id: _id }),
    ),
    findChildren: jest.fn().mockResolvedValue([]),
    findRoots: jest.fn().mockResolvedValue([]),
    findByParentId: jest.fn().mockResolvedValue([]),
    findAncestors: jest.fn().mockResolvedValue([]),
    ...overrides,
  }) as any;

// ---------------------------------------------------------------------------
// CreateCategoryUseCase — hierarchy validation
// ---------------------------------------------------------------------------

describe('CreateCategoryUseCase — parent validation', () => {
  it('creates a root category (no parentCategoryId) without hitting hierarchy queries', async () => {
    const repo = makeRepo();
    const uc = new CreateCategoryUseCase(repo);

    const result = await uc.execute({ name: 'Ropa' });

    expect(result).toBeDefined();
    // Hierarchy queries should not be called for root categories
    expect(repo.findAncestors).not.toHaveBeenCalled();
  });

  it('creates a child category when parent exists', async () => {
    const parent = makeCategory({ id: 'cat-parent', name: 'Bebé', slug: 'bebe' });
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(parent),
    });
    const uc = new CreateCategoryUseCase(repo);

    const result = await uc.execute({
      name: 'Ropa Bebé',
      parentCategoryId: 'cat-parent',
    });

    expect(result).toBeDefined();
    expect(repo.findById).toHaveBeenCalledWith('cat-parent');
  });

  it('throws NotFoundError when parentCategoryId points to a non-existent category', async () => {
    const repo = makeRepo({
      findByName: jest.fn().mockResolvedValue(null),
      findBySlug: jest.fn().mockResolvedValue(null),
      // findById returns null → parent does not exist
      findById: jest.fn().mockResolvedValue(null),
    });
    const uc = new CreateCategoryUseCase(repo);

    await expect(
      uc.execute({ name: 'Ropa Bebé', parentCategoryId: 'non-existent-parent' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// UpdateCategoryUseCase — parent validation + cycle detection
// ---------------------------------------------------------------------------

describe('UpdateCategoryUseCase — parent validation', () => {
  it('updates parent to a valid existing category', async () => {
    const currentCategory = makeCategory({ id: 'cat-1', parentId: null });
    const newParent = makeCategory({ id: 'cat-parent', name: 'Bebé' });

    const repo = makeRepo({
      // First call: findById('cat-1') → existing category
      // Second call: findById('cat-parent') → parent validation
      findById: jest
        .fn()
        .mockResolvedValueOnce(currentCategory)
        .mockResolvedValueOnce(newParent),
      findAncestors: jest.fn().mockResolvedValue([]), // cat-parent has no ancestors
    });
    const uc = new UpdateCategoryUseCase(repo);

    const result = await uc.execute({
      id: 'cat-1',
      parentCategoryId: 'cat-parent',
      currentUser: makeUser(),
    });

    expect(result.changes).toContain('parentCategoryId');
    expect(repo.update).toHaveBeenCalledWith(
      'cat-1',
      expect.objectContaining({ parentId: 'cat-parent' }),
      expect.anything(),
    );
  });

  it('throws NotFoundError when new parentCategoryId does not exist', async () => {
    const currentCategory = makeCategory({ id: 'cat-1', parentId: null });

    const repo = makeRepo({
      findById: jest
        .fn()
        .mockResolvedValueOnce(currentCategory) // existing category
        .mockResolvedValueOnce(null),            // parent does not exist
    });
    const uc = new UpdateCategoryUseCase(repo);

    await expect(
      uc.execute({ id: 'cat-1', parentCategoryId: 'missing-parent', currentUser: makeUser() }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws ValidationError when category is set as its own parent', async () => {
    const currentCategory = makeCategory({ id: 'cat-1', parentId: null });

    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(currentCategory),
    });
    const uc = new UpdateCategoryUseCase(repo);

    await expect(
      uc.execute({ id: 'cat-1', parentCategoryId: 'cat-1', currentUser: makeUser() }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws ValidationError when new parent is a direct child (would create cycle)', async () => {
    // cat-1 is the root; cat-child is currently a direct child of cat-1.
    // Attempting to set cat-child as the parent of cat-1 must be rejected.
    const rootCategory = makeCategory({ id: 'cat-1', parentId: null });
    const childCategory = makeCategory({ id: 'cat-child', name: 'Hijo', parentId: 'cat-1' });

    const repo = makeRepo({
      findById: jest
        .fn()
        .mockResolvedValueOnce(rootCategory)  // existing category (cat-1)
        .mockResolvedValueOnce(childCategory), // proposed parent (cat-child) — exists
      // cat-child's ancestors include cat-1, so the cycle check fires
      findAncestors: jest
        .fn()
        .mockResolvedValue([rootCategory]), // ancestors of cat-child = [cat-1]
    });
    const uc = new UpdateCategoryUseCase(repo);

    await expect(
      uc.execute({ id: 'cat-1', parentCategoryId: 'cat-child', currentUser: makeUser() }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws ValidationError when new parent is an indirect descendant (deep cycle)', async () => {
    // Hierarchy: cat-root → cat-mid → cat-deep
    // Attempting to set cat-deep as parent of cat-root must be rejected.
    const rootCategory = makeCategory({ id: 'cat-root', parentId: null });
    const midCategory = makeCategory({ id: 'cat-mid', parentId: 'cat-root' });
    const deepCategory = makeCategory({ id: 'cat-deep', parentId: 'cat-mid' });

    const repo = makeRepo({
      findById: jest
        .fn()
        .mockResolvedValueOnce(rootCategory) // existing category (cat-root)
        .mockResolvedValueOnce(deepCategory), // proposed parent (cat-deep) — exists
      // ancestors of cat-deep: [cat-root, cat-mid] (root-first order)
      findAncestors: jest
        .fn()
        .mockResolvedValue([rootCategory, midCategory]),
    });
    const uc = new UpdateCategoryUseCase(repo);

    await expect(
      uc.execute({
        id: 'cat-root',
        parentCategoryId: 'cat-deep',
        currentUser: makeUser(),
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('promotes category to root when parentCategoryId is set to null', async () => {
    const childCategory = makeCategory({ id: 'cat-1', parentId: 'cat-parent' });

    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(childCategory),
    });
    const uc = new UpdateCategoryUseCase(repo);

    const result = await uc.execute({
      id: 'cat-1',
      parentCategoryId: null,
      currentUser: makeUser(),
    });

    expect(result.changes).toContain('parentCategoryId');
    expect(repo.update).toHaveBeenCalledWith(
      'cat-1',
      expect.objectContaining({ parentId: null }),
      expect.anything(),
    );
  });

  it('no-op when parentCategoryId is omitted entirely (not in request)', async () => {
    const category = makeCategory({ id: 'cat-1', parentId: 'cat-parent' });

    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(category) });
    const uc = new UpdateCategoryUseCase(repo);

    // Only updating name — parentCategoryId not in the request object at all
    const result = await uc.execute({ id: 'cat-1', name: 'Ropa Updated', currentUser: makeUser() });

    expect(result.changes).not.toContain('parentCategoryId');
    // Parent-related repo methods should not be called
    expect(repo.findAncestors).not.toHaveBeenCalled();
  });
});
