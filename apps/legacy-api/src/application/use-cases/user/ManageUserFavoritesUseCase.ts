export interface UserFavorite {
  id: string;
  userId: string;
  productId: string;
  createdAt: Date;
}

export interface AddToFavoritesRequest {
  userId: string;
  productId: string;
}

export interface RemoveFromFavoritesRequest {
  userId: string;
  productId: string;
}

export interface IUserFavoritesRepository {
  addToFavorites(data: AddToFavoritesRequest): Promise<UserFavorite>;
  removeFromFavorites(data: RemoveFromFavoritesRequest): Promise<void>;
  getUserFavorites(userId: string): Promise<UserFavorite[]>;
  isFavorite(userId: string, productId: string): Promise<boolean>;
  getFavoriteStats(userId: string): Promise<{ totalFavorites: number }>;
}

export class ManageUserFavoritesUseCase {
  constructor(private favoritesRepository: IUserFavoritesRepository) {}

  async addToFavorites(data: AddToFavoritesRequest): Promise<UserFavorite> {
    // Validate inputs
    if (!data.userId || !data.productId) {
      throw new Error('User ID and Product ID are required');
    }

    // Check if already in favorites
    const isAlreadyFavorite = await this.favoritesRepository.isFavorite(data.userId, data.productId);
    if (isAlreadyFavorite) {
      throw new Error('Product is already in favorites');
    }

    // Add to favorites
    return await this.favoritesRepository.addToFavorites(data);
  }

  async removeFromFavorites(data: RemoveFromFavoritesRequest): Promise<void> {
    // Validate inputs
    if (!data.userId || !data.productId) {
      throw new Error('User ID and Product ID are required');
    }

    // Check if product is in favorites
    const isFavorite = await this.favoritesRepository.isFavorite(data.userId, data.productId);
    if (!isFavorite) {
      throw new Error('Product is not in favorites');
    }

    // Remove from favorites
    await this.favoritesRepository.removeFromFavorites(data);
  }

  async getUserFavorites(userId: string): Promise<UserFavorite[]> {
    // Validate input
    if (!userId) {
      throw new Error('User ID is required');
    }

    return await this.favoritesRepository.getUserFavorites(userId);
  }

  async toggleFavorite(userId: string, productId: string): Promise<{ action: 'added' | 'removed'; favorite?: UserFavorite }> {
    // Validate inputs
    if (!userId || !productId) {
      throw new Error('User ID and Product ID are required');
    }

    const isFavorite = await this.favoritesRepository.isFavorite(userId, productId);

    if (isFavorite) {
      await this.favoritesRepository.removeFromFavorites({ userId, productId });
      return { action: 'removed' };
    } else {
      const favorite = await this.favoritesRepository.addToFavorites({ userId, productId });
      return { action: 'added', favorite };
    }
  }

  async getFavoriteStats(userId: string): Promise<{ totalFavorites: number }> {
    // Validate input
    if (!userId) {
      throw new Error('User ID is required');
    }

    return await this.favoritesRepository.getFavoriteStats(userId);
  }
}