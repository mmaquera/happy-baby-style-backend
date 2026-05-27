import { PrismaClient } from '@prisma/client';
import {
  IUserFavoritesRepository,
  AddToFavoritesRequest,
  RemoveFromFavoritesRequest,
  UserFavorite,
} from '@application/use-cases/user/ManageUserFavoritesUseCase';

export class PrismaUserFavoritesRepository implements IUserFavoritesRepository {
  constructor(private prisma: PrismaClient) {}

  async addToFavorites(data: AddToFavoritesRequest): Promise<UserFavorite> {
    const fav = await this.prisma.userFavorite.create({
      data: { userId: data.userId, productId: data.productId },
    });
    return { id: fav.id, userId: fav.userId, productId: fav.productId, createdAt: fav.createdAt };
  }

  async removeFromFavorites(data: RemoveFromFavoritesRequest): Promise<void> {
    await this.prisma.userFavorite.deleteMany({
      where: { userId: data.userId, productId: data.productId },
    });
  }

  async getUserFavorites(userId: string): Promise<UserFavorite[]> {
    const favs = await this.prisma.userFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return favs.map((f) => ({
      id: f.id,
      userId: f.userId,
      productId: f.productId,
      createdAt: f.createdAt,
    }));
  }

  async isFavorite(userId: string, productId: string): Promise<boolean> {
    const count = await this.prisma.userFavorite.count({ where: { userId, productId } });
    return count > 0;
  }

  async getFavoriteStats(userId: string): Promise<{ totalFavorites: number }> {
    const totalFavorites = await this.prisma.userFavorite.count({ where: { userId } });
    return { totalFavorites };
  }
}
