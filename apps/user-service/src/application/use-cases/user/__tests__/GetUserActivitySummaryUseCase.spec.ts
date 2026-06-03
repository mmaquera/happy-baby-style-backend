jest.mock('@hbs/logging', () => ({
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
}), { virtual: true });

import { GetUserActivitySummaryUseCase } from '../GetUserActivitySummaryUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { IUserFavoritesRepository } from '../ManageUserFavoritesUseCase';
import type { User } from '../../../../domain/entities/User';
import type { UserFavorite } from '../ManageUserFavoritesUseCase';
import { NotFoundError, ValidationError } from '../../../../domain/errors/DomainError';

const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const PRODUCT_A = 'pppppppp-0000-1111-2222-333333333333';
const PRODUCT_B = 'pppppppp-4444-5555-6666-777777777777';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    email: 'jane@test.com',
    isActive: true,
    emailVerified: true,
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2026-03-01'),
    profile: {
      id: USER_ID,
      email: 'jane@test.com',
      firstName: 'Jane',
      lastName: 'Doe',
      emailVerified: true,
      isActive: true,
      lastLoginAt: new Date('2026-05-30'),
      createdAt: new Date('2025-01-15'),
      updatedAt: new Date('2026-03-01'),
      addresses: [],
      favoriteProductIds: [],
    },
    ...overrides,
  };
}

function makeFavorite(productId: string): UserFavorite {
  return { id: `fav-${productId}`, userId: USER_ID, productId, createdAt: new Date() };
}

function makeUserRepo(user: User | null = makeUser()): jest.Mocked<Pick<IUserRepository, 'getUserById'>> {
  return { getUserById: jest.fn().mockResolvedValue(user) } as any;
}

function makeFavRepo(favorites: UserFavorite[] = []): jest.Mocked<IUserFavoritesRepository> {
  return {
    addToFavorites: jest.fn(),
    removeFromFavorites: jest.fn(),
    getUserFavorites: jest.fn().mockResolvedValue(favorites),
    isFavorite: jest.fn(),
    getFavoriteStats: jest.fn(),
  } as any;
}

describe('GetUserActivitySummaryUseCase', () => {
  it('returns summary with favorites and join/lastActivity dates', async () => {
    const userRepo = makeUserRepo();
    const favRepo = makeFavRepo([makeFavorite(PRODUCT_A), makeFavorite(PRODUCT_B)]);
    const uc = new GetUserActivitySummaryUseCase(userRepo as any, favRepo);

    const result = await uc.execute(USER_ID);

    expect(result.totalFavorites).toBe(2);
    expect(result.favoriteProducts).toHaveLength(2);
    expect(result.favoriteProducts[0]).toEqual({ __typename: 'Product', id: PRODUCT_A });
    expect(result.joinDate).toEqual(new Date('2025-01-15'));
    // lastActivity should be the profile's lastLoginAt
    expect(result.lastActivity).toEqual(new Date('2026-05-30'));
    // recentOrders is always empty (federation-resolved)
    expect(result.recentOrders).toHaveLength(0);
  });

  it('falls back to updatedAt for lastActivity when lastLoginAt is absent', async () => {
    const user = makeUser({ profile: { ...makeUser().profile!, lastLoginAt: undefined } });
    const userRepo = makeUserRepo(user);
    const favRepo = makeFavRepo([]);
    const uc = new GetUserActivitySummaryUseCase(userRepo as any, favRepo);

    const result = await uc.execute(USER_ID);
    expect(result.lastActivity).toEqual(user.updatedAt);
  });

  it('caps favoriteProducts list at 10 items', async () => {
    const favs = Array.from({ length: 15 }, (_, i) => makeFavorite(`prod-${i}`));
    const userRepo = makeUserRepo();
    const favRepo = makeFavRepo(favs);
    const uc = new GetUserActivitySummaryUseCase(userRepo as any, favRepo);

    const result = await uc.execute(USER_ID);
    expect(result.favoriteProducts).toHaveLength(10);
    expect(result.totalFavorites).toBe(15);
  });

  it('returns zero favorites when user has none', async () => {
    const userRepo = makeUserRepo();
    const favRepo = makeFavRepo([]);
    const uc = new GetUserActivitySummaryUseCase(userRepo as any, favRepo);

    const result = await uc.execute(USER_ID);
    expect(result.totalFavorites).toBe(0);
    expect(result.favoriteProducts).toHaveLength(0);
  });

  it('throws NotFoundError when user does not exist', async () => {
    const userRepo = makeUserRepo(null);
    const favRepo = makeFavRepo([]);
    const uc = new GetUserActivitySummaryUseCase(userRepo as any, favRepo);

    await expect(uc.execute(USER_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError when userId is empty', async () => {
    const userRepo = makeUserRepo();
    const favRepo = makeFavRepo([]);
    const uc = new GetUserActivitySummaryUseCase(userRepo as any, favRepo);

    await expect(uc.execute('')).rejects.toBeInstanceOf(ValidationError);
  });
});
