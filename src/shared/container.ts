import { PrismaProductRepository } from '@infrastructure/repositories/PrismaProductRepository';
import { PrismaImageRepository } from '@infrastructure/repositories/PrismaImageRepository';
import { PrismaOrderRepository } from '@infrastructure/repositories/PrismaOrderRepository';
//import { InMemoryUserRepository } from '@infrastructure/repositories/InMemoryUserRepository';
import { PrismaUserProfileRepository } from '@infrastructure/repositories/PrismaUserProfileRepository';
import { PrismaCategoryRepository } from '@infrastructure/repositories/PrismaCategoryRepository';
import { prisma } from '@infrastructure/database/prisma';
import { LocalStorageService } from '@infrastructure/services/LocalStorageService';
import { JwtAuthService } from '@infrastructure/auth/JwtAuthService';
import { PrismaAuthRepository } from '@infrastructure/repositories/PrismaAuthRepository';
import { GoogleOAuthService } from '@infrastructure/auth/GoogleOAuthService';
import { CreateProductUseCase } from '@application/use-cases/product/CreateProductUseCase';
import { GetProductsUseCase } from '@application/use-cases/product/GetProductsUseCase';
import { GetProductByIdUseCase } from '@application/use-cases/product/GetProductByIdUseCase';
import { UpdateProductUseCase } from '@application/use-cases/product/UpdateProductUseCase';
import { DeleteProductUseCase } from '@application/use-cases/product/DeleteProductUseCase';
import { CreateCategoryUseCase } from '@application/use-cases/category/CreateCategoryUseCase';
import { GetCategoriesUseCase } from '@application/use-cases/category/GetCategoriesUseCase';
import { GetCategoryByIdUseCase } from '@application/use-cases/category/GetCategoryByIdUseCase';
import { GetCategoryBySlugUseCase } from '@application/use-cases/category/GetCategoryBySlugUseCase';
import { UpdateCategoryUseCase } from '@application/use-cases/category/UpdateCategoryUseCase';
import { DeleteCategoryUseCase } from '@application/use-cases/category/DeleteCategoryUseCase';
import { UploadImageUseCase } from '@application/use-cases/image/UploadImageUseCase';
import { CreateOrderUseCase } from '@application/use-cases/order/CreateOrderUseCase';
import { GetOrdersUseCase } from '@application/use-cases/order/GetOrdersUseCase';
import { GetOrderByIdUseCase } from '@application/use-cases/order/GetOrderByIdUseCase';
import { UpdateOrderUseCase } from '@application/use-cases/order/UpdateOrderUseCase';
import { GetOrderStatsUseCase } from '@application/use-cases/order/GetOrderStatsUseCase';
import { CreateUserUseCase } from '@application/use-cases/user/CreateUserUseCase';
import { GetUsersUseCase } from '@application/use-cases/user/GetUsersUseCase';
import { GetUserByIdUseCase } from '@application/use-cases/user/GetUserByIdUseCase';
import { UpdateUserUseCase } from '@application/use-cases/user/UpdateUserUseCase';
import { GetUserStatsUseCase } from '@application/use-cases/user/GetUserStatsUseCase';
import { AuthenticateUserUseCase } from '@application/use-cases/user/AuthenticateUserUseCase';
import { ManageUserFavoritesUseCase } from '@application/use-cases/user/ManageUserFavoritesUseCase';
import { GetUserOrderHistoryUseCase } from '@application/use-cases/user/GetUserOrderHistoryUseCase';
import { UpdateUserPasswordUseCase } from '@application/use-cases/user/UpdateUserPasswordUseCase';
// Controllers removed - GraphQL only architecture
import { IProductRepository } from '@domain/repositories/IProductRepository';
import { IImageRepository } from '@domain/repositories/IImageRepository';
import { IStorageService } from '@domain/interfaces/IStorageService';
import { IOrderRepository } from '@domain/repositories/IOrderRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ICategoryRepository } from '@domain/repositories/ICategoryRepository';
// Logging system imports
import { ILogger } from '@domain/interfaces/ILogger';
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';
import { WinstonLogger } from '@infrastructure/logging/WinstonLogger';
import { RequestLogger } from '@infrastructure/logging/RequestLogger';
import { PerformanceLogger } from '@infrastructure/logging/PerformanceLogger';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';

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
    // Initialize logging system
    LoggingDecorator.initialize();
    
    // Logging system
    const loggerFactory = LoggerFactory.getInstance();
    const defaultLogger: ILogger = loggerFactory.getDefaultLogger();
    const requestLogger = new RequestLogger();
    const performanceLogger = new PerformanceLogger();
    
    // Repositorios Prisma with logging  
    const productRepository: IProductRepository = new PrismaProductRepository(prisma);
    const imageRepository: IImageRepository = new PrismaImageRepository(prisma);
    const orderRepository: IOrderRepository = new PrismaOrderRepository(prisma);
    const categoryRepository: ICategoryRepository = new PrismaCategoryRepository(prisma);
    // Usar repositorio PostgreSQL real con AWS RDS
    const userRepository: IUserRepository = new PrismaUserProfileRepository(prisma);
    // const userRepository: IUserRepository = new InMemoryUserRepository();
    const authRepository: IAuthRepository = new PrismaAuthRepository(prisma);
    
    // Servicios
    const storageService: IStorageService = new LocalStorageService();
    const authService = new JwtAuthService(userRepository);
    const googleOAuthService = new GoogleOAuthService();
    
    // Casos de uso de Productos with logging
    const createProductUseCase = new CreateProductUseCase(productRepository);
    const getProductsUseCase = new GetProductsUseCase(productRepository);
    const getProductByIdUseCase = new GetProductByIdUseCase(productRepository);
    const updateProductUseCase = new UpdateProductUseCase(productRepository);
    const deleteProductUseCase = new DeleteProductUseCase(productRepository);
    
    // Casos de uso de Categorías
    const createCategoryUseCase = new CreateCategoryUseCase(categoryRepository);
    const getCategoriesUseCase = new GetCategoriesUseCase(categoryRepository);
    const getCategoryByIdUseCase = new GetCategoryByIdUseCase(categoryRepository);
    const getCategoryBySlugUseCase = new GetCategoryBySlugUseCase(categoryRepository);
    const updateCategoryUseCase = new UpdateCategoryUseCase(categoryRepository);
    const deleteCategoryUseCase = new DeleteCategoryUseCase(categoryRepository);
    
    // Casos de uso de Imágenes
    const uploadImageUseCase = new UploadImageUseCase(imageRepository, storageService);
    
    // Casos de uso de Pedidos
    const createOrderUseCase = new CreateOrderUseCase(orderRepository, productRepository);
    const getOrdersUseCase = new GetOrdersUseCase(orderRepository);
    const getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepository);
    const updateOrderUseCase = new UpdateOrderUseCase(orderRepository);
    const getOrderStatsUseCase = new GetOrderStatsUseCase(orderRepository);
    
    // Casos de uso de Usuarios
    const createUserUseCase = new CreateUserUseCase(userRepository);
    const getUsersUseCase = new GetUsersUseCase(userRepository);
    const getUserByIdUseCase = new GetUserByIdUseCase(userRepository);
    const updateUserUseCase = new UpdateUserUseCase(userRepository);
    const getUserStatsUseCase = new GetUserStatsUseCase(userRepository);
    
    // Nuevos casos de uso de usuarios
    const authenticateUserUseCase = new AuthenticateUserUseCase(userRepository);
    const manageUserFavoritesUseCase = new ManageUserFavoritesUseCase({
      addToFavorites: async () => { throw new Error('Not implemented'); },
      removeFromFavorites: async () => { throw new Error('Not implemented'); },
      getUserFavorites: async () => [],
      isFavorite: async () => false,
      getFavoriteStats: async () => ({ totalFavorites: 0 })
    });
    const getUserOrderHistoryUseCase = new GetUserOrderHistoryUseCase({
      getUserOrders: async () => ({ orders: [], total: 0 }),
      getUserOrderStats: async () => ({
        totalOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0
      })
    });
    const updateUserPasswordUseCase = new UpdateUserPasswordUseCase({
      verifyPassword: async () => false,
      updatePassword: async () => {},
      getUserById: async () => null
    });
    
    // Controllers removed - GraphQL only architecture

    // Registrar dependencias
    this.dependencies.set('authService', authService);
    this.dependencies.set('authRepository', authRepository);
    this.dependencies.set('googleOAuthService', googleOAuthService);
    this.dependencies.set('productRepository', productRepository);
    this.dependencies.set('imageRepository', imageRepository);
    this.dependencies.set('orderRepository', orderRepository);
    this.dependencies.set('categoryRepository', categoryRepository);
    this.dependencies.set('userRepository', userRepository);
    this.dependencies.set('storageService', storageService);
    
    // Logging dependencies
    this.dependencies.set('loggerFactory', loggerFactory);
    this.dependencies.set('defaultLogger', defaultLogger);
    this.dependencies.set('requestLogger', requestLogger);
    this.dependencies.set('performanceLogger', performanceLogger);
    
    // Casos de uso
    this.dependencies.set('createProductUseCase', createProductUseCase);
    this.dependencies.set('getProductsUseCase', getProductsUseCase);
    this.dependencies.set('getProductByIdUseCase', getProductByIdUseCase);
    this.dependencies.set('updateProductUseCase', updateProductUseCase);
    this.dependencies.set('deleteProductUseCase', deleteProductUseCase);
    this.dependencies.set('createCategoryUseCase', createCategoryUseCase);
    this.dependencies.set('getCategoriesUseCase', getCategoriesUseCase);
    this.dependencies.set('getCategoryByIdUseCase', getCategoryByIdUseCase);
    this.dependencies.set('getCategoryBySlugUseCase', getCategoryBySlugUseCase);
    this.dependencies.set('updateCategoryUseCase', updateCategoryUseCase);
    this.dependencies.set('deleteCategoryUseCase', deleteCategoryUseCase);
    this.dependencies.set('uploadImageUseCase', uploadImageUseCase);
    this.dependencies.set('createOrderUseCase', createOrderUseCase);
    this.dependencies.set('getOrdersUseCase', getOrdersUseCase);
    this.dependencies.set('getOrderByIdUseCase', getOrderByIdUseCase);
    this.dependencies.set('updateOrderUseCase', updateOrderUseCase);
    this.dependencies.set('getOrderStatsUseCase', getOrderStatsUseCase);
    this.dependencies.set('createUserUseCase', createUserUseCase);
    this.dependencies.set('getUsersUseCase', getUsersUseCase);
    this.dependencies.set('getUserByIdUseCase', getUserByIdUseCase);
    this.dependencies.set('updateUserUseCase', updateUserUseCase);
    this.dependencies.set('getUserStatsUseCase', getUserStatsUseCase);
    this.dependencies.set('authenticateUserUseCase', authenticateUserUseCase);
    this.dependencies.set('manageUserFavoritesUseCase', manageUserFavoritesUseCase);
    this.dependencies.set('getUserOrderHistoryUseCase', getUserOrderHistoryUseCase);
    this.dependencies.set('updateUserPasswordUseCase', updateUserPasswordUseCase);
    
    // Controllers removed - GraphQL only architecture
  }

  get<T>(key: string): T {
    const dependency = this.dependencies.get(key);
    if (!dependency) {
      throw new Error(`Dependency '${key}' not found`);
    }
    return dependency;
  }
}