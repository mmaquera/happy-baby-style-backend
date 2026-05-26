import { PrismaProductRepository } from '@infrastructure/repositories/PrismaProductRepository';
import { PrismaOrderRepository } from '@infrastructure/repositories/PrismaOrderRepository';
import { PrismaUserProfileRepository } from '@infrastructure/repositories/PrismaUserProfileRepository';
import { prisma } from '@infrastructure/database/prisma';
import { GetProductsUseCase } from '@application/use-cases/product/GetProductsUseCase';
import { GetOrderStatsUseCase } from '@application/use-cases/order/GetOrderStatsUseCase';
import { GetUserStatsUseCase } from '@application/use-cases/user/GetUserStatsUseCase';
import { ManageUserFavoritesUseCase } from '@application/use-cases/user/ManageUserFavoritesUseCase';
import { RateLimitService } from '@application/services/RateLimitService';
import { IProductRepository } from '@domain/repositories/IProductRepository';
import { IOrderRepository } from '@domain/repositories/IOrderRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { ILogger } from '@hbs/logging';
import { LoggerFactory } from '@hbs/logging';
import { LoggingDecorator } from '@hbs/logging';

export class Container {
  private static instance: Container;
  private dependencies: Map<string, any> = new Map();

  static getInstance(): Container {
    if (!this.instance) {
      this.instance = new Container();
      this.instance.registerDependencies();
    }
    return this.instance;
  }

  private registerDependencies(): void {
    LoggingDecorator.initialize();

    const loggerFactory = LoggerFactory.getInstance();
    const defaultLogger: ILogger = loggerFactory.getDefaultLogger();

    // Repositories needed for cross-domain analytics (dashboardMetrics, orderStats, userStats)
    // and favorites (not yet extracted to its own service)
    const productRepository: IProductRepository = new PrismaProductRepository(prisma);
    const orderRepository: IOrderRepository = new PrismaOrderRepository(prisma);
    const userRepository: IUserRepository = new PrismaUserProfileRepository(prisma);

    // Cross-domain aggregation use cases (dashboardMetrics, orderStats, userStats, userAnalytics)
    const getProductsUseCase = new GetProductsUseCase(productRepository);
    const getOrderStatsUseCase = new GetOrderStatsUseCase(orderRepository);
    const getUserStatsUseCase = new GetUserStatsUseCase(userRepository);

    // Favorites — not yet extracted to its own service; uses a stub repository
    const manageUserFavoritesUseCase = new ManageUserFavoritesUseCase({
      addToFavorites: async () => { throw new Error('Not implemented'); },
      removeFromFavorites: async () => { throw new Error('Not implemented'); },
      getUserFavorites: async () => [],
      isFavorite: async () => false,
      getFavoriteStats: async () => ({ totalFavorites: 0 })
    });

    const rateLimitService = new RateLimitService(defaultLogger);

    // Register
    this.dependencies.set('loggerFactory', loggerFactory);
    this.dependencies.set('defaultLogger', defaultLogger);
    this.dependencies.set('rateLimitService', rateLimitService);
    this.dependencies.set('productRepository', productRepository);
    this.dependencies.set('orderRepository', orderRepository);
    this.dependencies.set('userRepository', userRepository);

    // category use cases → migrated to category-service (Federation)
    // product create/update/delete → migrated to product-service (Federation)
    // order use cases → migrated to order-service (Federation)
    // user/auth/address/session use cases → migrated to user-service (Federation)
    this.dependencies.set('getProductsUseCase', getProductsUseCase);
    this.dependencies.set('getOrderStatsUseCase', getOrderStatsUseCase);
    this.dependencies.set('getUserStatsUseCase', getUserStatsUseCase);
    this.dependencies.set('manageUserFavoritesUseCase', manageUserFavoritesUseCase);
  }

  get<T>(key: string): T {
    const dependency = this.dependencies.get(key);
    if (!dependency) {
      throw new Error(`Dependency '${key}' not found`);
    }
    return dependency;
  }
}
