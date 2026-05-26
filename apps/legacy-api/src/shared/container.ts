import { PrismaProductRepository } from '@infrastructure/repositories/PrismaProductRepository';
import { PrismaImageRepository } from '@infrastructure/repositories/PrismaImageRepository';
import { PrismaSvgRepository } from '@infrastructure/repositories/PrismaSvgRepository';
import { PrismaOrderRepository } from '@infrastructure/repositories/PrismaOrderRepository';
//import { InMemoryUserRepository } from '@infrastructure/repositories/InMemoryUserRepository';
import { PrismaUserProfileRepository } from '@infrastructure/repositories/PrismaUserProfileRepository';
import { prisma } from '@infrastructure/database/prisma';
import { LocalStorageService } from '@infrastructure/services/LocalStorageService';
import { JwtAuthService } from '@infrastructure/auth/JwtAuthService';
import { PrismaAuthRepository } from '@infrastructure/repositories/PrismaAuthRepository';
import { PrismaAuditRepository } from '@infrastructure/repositories/PrismaAuditRepository';
import { PrismaSecurityEventRepository } from '@infrastructure/repositories/PrismaSecurityEventRepository';
import { GoogleOAuthService } from '@infrastructure/auth/GoogleOAuthService';
import { CreateProductUseCase } from '@application/use-cases/product/CreateProductUseCase';
import { GetProductsUseCase } from '@application/use-cases/product/GetProductsUseCase';
import { GetProductByIdUseCase } from '@application/use-cases/product/GetProductByIdUseCase';
import { UpdateProductUseCase } from '@application/use-cases/product/UpdateProductUseCase';
import { DeleteProductUseCase } from '@application/use-cases/product/DeleteProductUseCase';
import { UploadImageUseCase } from '@application/use-cases/image/UploadImageUseCase';
import { UploadSvgUseCase } from '@application/use-cases/svg/UploadSvgUseCase';
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
import { SetUserPasswordUseCase } from '@application/use-cases/user/SetUserPasswordUseCase';
import { LogoutUserUseCase } from '@application/use-cases/user/LogoutUserUseCase';
import { RefreshTokenUseCase } from '@application/use-cases/user/RefreshTokenUseCase';
import { CreateUserAddressUseCase } from '@application/use-cases/user/CreateUserAddressUseCase';
import { UpdateUserAddressUseCase } from '@application/use-cases/user/UpdateUserAddressUseCase';
import { DeleteUserAddressUseCase } from '@application/use-cases/user/DeleteUserAddressUseCase';
import { GetUserAddressByIdUseCase } from '@application/use-cases/user/GetUserAddressByIdUseCase';
import { SetDefaultAddressUseCase } from '@application/use-cases/user/SetDefaultAddressUseCase';
import { CreateUserSessionAnalyticsUseCase } from '@application/use-cases/user/CreateUserSessionAnalyticsUseCase';
import { UpdateUserSessionAnalyticsUseCase } from '@application/use-cases/user/UpdateUserSessionAnalyticsUseCase';
import { GetUserSessionAnalyticsUseCase } from '@application/use-cases/user/GetUserSessionAnalyticsUseCase';
import { RevokeUserSessionUseCase } from '@application/use-cases/user/RevokeUserSessionUseCase';
import { RevokeAllUserSessionsUseCase } from '@application/use-cases/user/RevokeAllUserSessionsUseCase';
import { SessionService } from '@application/auth/SessionService';
import { RateLimitService } from '@application/services/RateLimitService';
// Controllers removed - GraphQL only architecture
import { IProductRepository } from '@domain/repositories/IProductRepository';
import { IImageRepository } from '@domain/repositories/IImageRepository';
import { ISvgRepository } from '@domain/repositories/ISvgRepository';
import { IStorageService } from '@domain/interfaces/IStorageService';
import { IOrderRepository } from '@domain/repositories/IOrderRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { IAuditRepository } from '@domain/repositories/IAuditRepository';
import { ISecurityEventRepository } from '@domain/repositories/ISecurityEventRepository';
// Logging system imports
import { ILogger } from '@hbs/logging';
import { LoggerFactory } from '@hbs/logging';
import { WinstonLogger } from '@hbs/logging';
import { RequestLogger } from '@hbs/logging';
import { PerformanceLogger } from '@hbs/logging';
import { LoggingDecorator } from '@hbs/logging';
import { IEmailService } from '@domain/interfaces/IEmailService';
import { NodemailerEmailService } from '@infrastructure/services/NodemailerEmailService';
import { environment } from '@config/environment';

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
    const svgRepository: ISvgRepository = new PrismaSvgRepository(prisma);
    const orderRepository: IOrderRepository = new PrismaOrderRepository(prisma);
    // Usar repositorio PostgreSQL real con AWS RDS
    const userRepository: IUserRepository = new PrismaUserProfileRepository(prisma);
    // const userRepository: IUserRepository = new InMemoryUserRepository();
    const authRepository: IAuthRepository = new PrismaAuthRepository(prisma);
    const auditRepository: IAuditRepository = new PrismaAuditRepository(prisma);
    const securityEventRepository: ISecurityEventRepository = new PrismaSecurityEventRepository(prisma);
    
    // Servicios
    const storageService: IStorageService = new LocalStorageService();
    const authService = new JwtAuthService(userRepository);
    const googleOAuthService = new GoogleOAuthService();
    
    // Email Service
    const emailConfig = environment.getEmailConfig();
    const emailService: IEmailService = new NodemailerEmailService(emailConfig, defaultLogger);
    
    // Casos de uso de Productos with logging
    const createProductUseCase = new CreateProductUseCase(productRepository);
    const getProductsUseCase = new GetProductsUseCase(productRepository);
    const getProductByIdUseCase = new GetProductByIdUseCase(productRepository);
    const updateProductUseCase = new UpdateProductUseCase(productRepository);
    const deleteProductUseCase = new DeleteProductUseCase(productRepository);
    
    // Casos de uso de Categorías → migradas a category-service (Federation)

    // Casos de uso de Imágenes
    const uploadImageUseCase = new UploadImageUseCase(imageRepository, storageService);
    
    // Casos de uso de SVG
    const uploadSvgUseCase = new UploadSvgUseCase(svgRepository, storageService);
    
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
    const authenticateUserUseCase = new AuthenticateUserUseCase(userRepository, authRepository, defaultLogger);
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
    const updateUserPasswordUseCase = new UpdateUserPasswordUseCase(
      authRepository, 
      auditRepository, 
      securityEventRepository, 
      emailService, 
      defaultLogger
    );
    const setUserPasswordUseCase = new SetUserPasswordUseCase(
      authRepository, 
      auditRepository, 
      securityEventRepository, 
      defaultLogger
    );
    
    // Caso de uso de logout
    const logoutUserUseCase = new LogoutUserUseCase(authRepository, defaultLogger);
    
    // Caso de uso de refresh token
    const refreshTokenUseCase = new RefreshTokenUseCase(authRepository, defaultLogger);
    
    // Casos de uso de direcciones de usuario
    const createUserAddressUseCase = new CreateUserAddressUseCase(userRepository);
    const updateUserAddressUseCase = new UpdateUserAddressUseCase(userRepository);
    const deleteUserAddressUseCase = new DeleteUserAddressUseCase(userRepository);
    const getUserAddressByIdUseCase = new GetUserAddressByIdUseCase(userRepository);
    const setDefaultAddressUseCase = new SetDefaultAddressUseCase(userRepository);
    
    // Casos de uso de UserSessionAnalytics
    const createUserSessionAnalyticsUseCase = new CreateUserSessionAnalyticsUseCase(authRepository, defaultLogger);
    const updateUserSessionAnalyticsUseCase = new UpdateUserSessionAnalyticsUseCase(authRepository, defaultLogger);
    const getUserSessionAnalyticsUseCase = new GetUserSessionAnalyticsUseCase(authRepository, defaultLogger);
    
    // Casos de uso de revocación de sesiones
    const revokeUserSessionUseCase = new RevokeUserSessionUseCase(authRepository, defaultLogger);
    const revokeAllUserSessionsUseCase = new RevokeAllUserSessionsUseCase(authRepository, defaultLogger);
    
    // Servicios de autenticación
    const sessionService = new SessionService(authRepository, defaultLogger);
    
    // Servicios de rate limiting
    const rateLimitService = new RateLimitService(defaultLogger);
    
    // Controllers removed - GraphQL only architecture

    // Registrar dependencias
    this.dependencies.set('authService', authService);
    this.dependencies.set('authRepository', authRepository);
    this.dependencies.set('auditRepository', auditRepository);
    this.dependencies.set('securityEventRepository', securityEventRepository);
    this.dependencies.set('googleOAuthService', googleOAuthService);
    this.dependencies.set('productRepository', productRepository);
    this.dependencies.set('imageRepository', imageRepository);
    this.dependencies.set('svgRepository', svgRepository);
    this.dependencies.set('orderRepository', orderRepository);
    this.dependencies.set('userRepository', userRepository);
    this.dependencies.set('storageService', storageService);
    this.dependencies.set('emailService', emailService);
    
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
    // category use cases → migrated to category-service
    this.dependencies.set('uploadImageUseCase', uploadImageUseCase);
    this.dependencies.set('uploadSvgUseCase', uploadSvgUseCase);
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
    this.dependencies.set('setUserPasswordUseCase', setUserPasswordUseCase);
    this.dependencies.set('createUserAddressUseCase', createUserAddressUseCase);
    this.dependencies.set('updateUserAddressUseCase', updateUserAddressUseCase);
    this.dependencies.set('deleteUserAddressUseCase', deleteUserAddressUseCase);
    this.dependencies.set('getUserAddressByIdUseCase', getUserAddressByIdUseCase);
    this.dependencies.set('setDefaultAddressUseCase', setDefaultAddressUseCase);
    this.dependencies.set('logoutUserUseCase', logoutUserUseCase);
    this.dependencies.set('refreshTokenUseCase', refreshTokenUseCase);
    
    // UserSessionAnalytics use cases
    this.dependencies.set('createUserSessionAnalyticsUseCase', createUserSessionAnalyticsUseCase);
    this.dependencies.set('updateUserSessionAnalyticsUseCase', updateUserSessionAnalyticsUseCase);
    this.dependencies.set('getUserSessionAnalyticsUseCase', getUserSessionAnalyticsUseCase);
    
    // Session revocation use cases
    this.dependencies.set('revokeUserSessionUseCase', revokeUserSessionUseCase);
    this.dependencies.set('revokeAllUserSessionsUseCase', revokeAllUserSessionsUseCase);
    
    this.dependencies.set('sessionService', sessionService);
    this.dependencies.set('rateLimitService', rateLimitService);
    
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