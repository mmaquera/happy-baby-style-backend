jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import {
  ManageUserFavoritesUseCase,
  IUserFavoritesRepository,
  UserFavorite,
} from '../ManageUserFavoritesUseCase';

function makeFavorite(overrides: Partial<UserFavorite> = {}): UserFavorite {
  return {
    id: 'fav-1',
    userId: 'user-1',
    productId: 'prod-1',
    createdAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<IUserFavoritesRepository> = {}): jest.Mocked<IUserFavoritesRepository> {
  return {
    addToFavorites: jest.fn().mockResolvedValue(makeFavorite()),
    removeFromFavorites: jest.fn().mockResolvedValue(undefined),
    getUserFavorites: jest.fn().mockResolvedValue([makeFavorite()]),
    isFavorite: jest.fn().mockResolvedValue(false),
    getFavoriteStats: jest.fn().mockResolvedValue({ totalFavorites: 1 }),
    ...overrides,
  } as any;
}

describe('ManageUserFavoritesUseCase', () => {
  describe('addToFavorites', () => {
    it('adds a product to favorites', async () => {
      const repo = makeRepo();
      const uc = new ManageUserFavoritesUseCase(repo);
      const result = await uc.addToFavorites({ userId: 'user-1', productId: 'prod-1' });
      expect(result.productId).toBe('prod-1');
      expect(repo.addToFavorites).toHaveBeenCalled();
    });

    it('throws when product is already in favorites', async () => {
      const repo = makeRepo({ isFavorite: jest.fn().mockResolvedValue(true) });
      const uc = new ManageUserFavoritesUseCase(repo);
      await expect(uc.addToFavorites({ userId: 'user-1', productId: 'prod-1' })).rejects.toThrow(
        'already in favorites',
      );
    });

    it('throws when userId is missing', async () => {
      const repo = makeRepo();
      const uc = new ManageUserFavoritesUseCase(repo);
      await expect(uc.addToFavorites({ userId: '', productId: 'prod-1' })).rejects.toThrow();
    });
  });

  describe('removeFromFavorites', () => {
    it('removes a product from favorites', async () => {
      const repo = makeRepo({ isFavorite: jest.fn().mockResolvedValue(true) });
      const uc = new ManageUserFavoritesUseCase(repo);
      await uc.removeFromFavorites({ userId: 'user-1', productId: 'prod-1' });
      expect(repo.removeFromFavorites).toHaveBeenCalled();
    });

    it('throws when product is not in favorites', async () => {
      const repo = makeRepo({ isFavorite: jest.fn().mockResolvedValue(false) });
      const uc = new ManageUserFavoritesUseCase(repo);
      await expect(
        uc.removeFromFavorites({ userId: 'user-1', productId: 'prod-1' }),
      ).rejects.toThrow('not in favorites');
    });
  });

  describe('getUserFavorites', () => {
    it('returns favorites for a user', async () => {
      const repo = makeRepo();
      const uc = new ManageUserFavoritesUseCase(repo);
      const result = await uc.getUserFavorites('user-1');
      expect(result).toHaveLength(1);
    });

    it('throws when userId is missing', async () => {
      const repo = makeRepo();
      const uc = new ManageUserFavoritesUseCase(repo);
      await expect(uc.getUserFavorites('')).rejects.toThrow();
    });
  });

  describe('toggleFavorite', () => {
    it('adds when not a favorite', async () => {
      const repo = makeRepo({ isFavorite: jest.fn().mockResolvedValue(false) });
      const uc = new ManageUserFavoritesUseCase(repo);
      const result = await uc.toggleFavorite('user-1', 'prod-1');
      expect(result.action).toBe('added');
    });

    it('removes when already a favorite', async () => {
      const repo = makeRepo({ isFavorite: jest.fn().mockResolvedValue(true) });
      const uc = new ManageUserFavoritesUseCase(repo);
      const result = await uc.toggleFavorite('user-1', 'prod-1');
      expect(result.action).toBe('removed');
    });
  });
});
