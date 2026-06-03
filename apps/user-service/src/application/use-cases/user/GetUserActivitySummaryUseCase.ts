import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IUserFavoritesRepository } from '@application/use-cases/user/ManageUserFavoritesUseCase';
import { NotFoundError, ValidationError } from '@domain/errors/DomainError';
import { LoggerFactory } from '@hbs/logging';

/**
 * UserActivitySummary — fields sourced from data available in user-service today.
 *
 * Design decisions:
 *  - recentOrders: omitted — orders live in order-service. The Order federation stub
 *    in user-service schema means orders are composed at the gateway layer.
 *    `userOrderHistory` query (federation) handles this. We return an empty array
 *    so the SDL type remains backward-compatible while federation resolves orders.
 *  - cartItemsCount: omitted — no cart data source in user-service. Field removed from
 *    this response (SDL updated separately to remove it).
 *  - favoriteProducts: user-service owns UserFavorite; we return product stubs so the
 *    gateway can resolve full Product entities via federation.
 *  - joinDate: createdAt of the UserProfile record.
 *  - lastActivity: lastLoginAt if set; otherwise createdAt (fallback).
 */
export interface UserActivitySummaryResponse {
  /** Federation stubs — gateway resolves full Order entities via order-service */
  recentOrders: Array<{ __typename: 'Order'; id: string }>;
  /** Federation stubs — gateway resolves full Product entities via product-service */
  favoriteProducts: Array<{ __typename: 'Product'; id: string }>;
  totalFavorites: number;
  joinDate: Date;
  lastActivity: Date;
}

export class GetUserActivitySummaryUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'GetUserActivitySummaryUseCase',
  );

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly favoritesRepository: IUserFavoritesRepository,
  ) {}

  async execute(userId: string): Promise<UserActivitySummaryResponse> {
    if (!userId) {
      throw new ValidationError('userId is required', 'userId');
    }

    this.logger.info('Getting user activity summary', { userId });

    const user = await this.userRepository.getUserById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const favorites = await this.favoritesRepository.getUserFavorites(userId);
    const totalFavorites = favorites.length;

    // Derive lastActivity: prefer lastLoginAt; fall back to updatedAt then createdAt.
    const lastActivity = user.profile?.lastLoginAt ?? user.updatedAt ?? user.createdAt;
    const joinDate = user.createdAt;

    const favoriteProducts = favorites.slice(0, 10).map((f) => ({
      __typename: 'Product' as const,
      id: f.productId,
    }));

    this.logger.info('User activity summary retrieved', {
      userId,
      totalFavorites,
    });

    return {
      // Orders are federation-resolved via userOrderHistory query — return empty here.
      recentOrders: [],
      favoriteProducts,
      totalFavorites,
      joinDate,
      lastActivity,
    };
  }
}
