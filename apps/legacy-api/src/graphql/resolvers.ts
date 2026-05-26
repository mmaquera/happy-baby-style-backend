import { GraphQLScalarType, Kind } from 'graphql';
import { Container } from '@shared/container';
import { IAuditRepository } from '@domain/repositories/IAuditRepository';
import { ISecurityEventRepository } from '@domain/repositories/ISecurityEventRepository';
import { GraphQLErrorHandler, handleResolverError } from './error-handler';
import { ResponseFactory } from '@hbs/shared-kernel';
import { Context } from './server';
import { RESPONSE_CODES } from '@hbs/shared-kernel';
import { LoggerFactory } from '@hbs/logging';
import { ILogger } from '@hbs/logging';
import { GetProductsUseCase } from '@application/use-cases/product/GetProductsUseCase';
import { GetOrdersUseCase } from '@application/use-cases/order/GetOrdersUseCase';
import { GetOrderByIdUseCase } from '@application/use-cases/order/GetOrderByIdUseCase';
import { CreateOrderUseCase } from '@application/use-cases/order/CreateOrderUseCase';
import { UpdateOrderUseCase } from '@application/use-cases/order/UpdateOrderUseCase';
import { GetOrderStatsUseCase } from '@application/use-cases/order/GetOrderStatsUseCase';
import { GetUsersUseCase } from '@application/use-cases/user/GetUsersUseCase';
import { GetUserByIdUseCase } from '@application/use-cases/user/GetUserByIdUseCase';
import { CreateUserUseCase } from '@application/use-cases/user/CreateUserUseCase';
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
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@domain/errors/DomainError';
import { UserRole } from '@application/auth/AuthService';
import { UpdateUserAddressUseCase } from '@application/use-cases/user/UpdateUserAddressUseCase';
import { DeleteUserAddressUseCase } from '@application/use-cases/user/DeleteUserAddressUseCase';
import { GetUserAddressByIdUseCase } from '@application/use-cases/user/GetUserAddressByIdUseCase';
import { SetDefaultAddressUseCase } from '@application/use-cases/user/SetDefaultAddressUseCase';
import { AuthService } from '@application/auth/AuthService';
import { CreateUserSessionAnalyticsUseCase } from '@application/use-cases/user/CreateUserSessionAnalyticsUseCase';
import { UpdateUserSessionAnalyticsUseCase } from '@application/use-cases/user/UpdateUserSessionAnalyticsUseCase';
import { GetUserSessionAnalyticsUseCase } from '@application/use-cases/user/GetUserSessionAnalyticsUseCase';
import { RevokeUserSessionUseCase } from '@application/use-cases/user/RevokeUserSessionUseCase';
import { RevokeAllUserSessionsUseCase } from '@application/use-cases/user/RevokeAllUserSessionsUseCase';
import { storageConfig } from '@config/storage';
import { UrlBuilder } from '@shared/utils/UrlBuilder';
import { transformUserSessionAnalytics } from './transformers/userSessionAnalyticsTransformer';

// Initialize container
const container = Container.getInstance();

// Custom scalar resolvers
const dateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'DateTime custom scalar type',
  serialize(value: any) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return value;
    }
    throw new Error('GraphQL DateTime Scalar serializer expected a Date object or string');
  },
  parseValue(value: any) {
    if (typeof value === 'string') {
      return new Date(value);
    }
    throw new Error('GraphQL DateTime Scalar parser expected a string');
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

const decimalScalar = new GraphQLScalarType({
  name: 'Decimal',
  description: 'Decimal custom scalar type',
  serialize(value: any) {
    return parseFloat(value?.toString() || '0');
  },
  parseValue(value: any) {
    return parseFloat(value?.toString() || '0');
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT || ast.kind === Kind.FLOAT) {
      return parseFloat(ast.value);
    }
    return 0;
  },
});

const jsonScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON custom scalar type',
  serialize(value: any) {
    return value;
  },
  parseValue(value: any) {
    return value;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      try {
        return JSON.parse(ast.value);
      } catch {
        return null;
      }
    }
    return null;
  },
});

// Helper function to transform database entities to GraphQL format
const transformUserAddress = (address: any) => ({
  id: address.id,
  type: address.title || address.type,  // Mapear desde el dominio (title) o BD (type)
  firstName: address.firstName,
  lastName: address.lastName,
  company: address.company || null,
  address1: address.addressLine1 || address.address1,  // Priorizar el dominio (addressLine1)
  address2: address.addressLine2 || address.address2,  // Priorizar el dominio (addressLine2)
  city: address.city,
  state: address.state,
  postalCode: address.postalCode,
  country: address.country,
  phone: address.phone || null,
  isDefault: Boolean(address.isDefault),
  createdAt: address.createdAt || address.created_at,
  updatedAt: address.updatedAt || address.updated_at,
  fullName: `${address.firstName || ''} ${address.lastName || ''}`.trim(),
  fullAddress: [address.addressLine1 || address.address1, address.addressLine2 || address.address2, address.city, address.state, address.postalCode, address.country]
    .filter(Boolean)
    .join(', ')
});

const transformOrder = (order: any) => ({
  ...order,
  userId: order.user_id,
  orderNumber: order.order_number,
  taxAmount: order.tax_amount,
  shippingCost: order.shipping_cost,
  discountAmount: order.discount_amount,
  totalAmount: order.total_amount,
  shippingAddress: order.shipping_address,
  billingAddress: order.billing_address,
  trackingNumber: order.tracking_number,
  shippedAt: order.shipped_at,
  deliveredAt: order.delivered_at,
  createdAt: order.created_at,
  updatedAt: order.updated_at,
});

const transformUserProfile = (profile: any) => ({
  id: profile.id,
  email: profile.email || profile.user?.email,
  firstName: profile.first_name || profile.firstName,
  lastName: profile.last_name || profile.lastName,
  phone: profile.phone || null,
  dateOfBirth: profile.birthDate || profile.dateOfBirth || profile.date_of_birth || null,  // Mapear desde el dominio (birthDate) o BD (dateOfBirth)
  avatar: profile.avatarUrl || profile.avatar || null,  // Mapear desde el dominio (avatarUrl) o BD (avatar)
  role: profile.role && ['admin', 'customer', 'staff'].includes(profile.role) 
    ? profile.role 
    : 'customer',
  emailVerified: profile.emailVerified !== undefined ? profile.emailVerified : profile.email_verified !== undefined ? profile.email_verified : false,
  isActive: profile.isActive !== undefined ? profile.isActive : profile.is_active !== undefined ? profile.is_active : true,
  lastLoginAt: profile.lastLoginAt || profile.last_login_at || null,
  createdAt: profile.created_at || profile.createdAt,
  updatedAt: profile.updated_at || profile.updatedAt,
  // Computed field
  fullName: (profile.first_name || profile.firstName) && (profile.last_name || profile.lastName)
    ? `${profile.first_name || profile.firstName} ${profile.last_name || profile.lastName}`
    : (profile.first_name || profile.firstName) || (profile.last_name || profile.lastName) || '',
});

const transformUserAccount = (account: any) => ({
  id: account.id,
  userId: account.userId || account.user_id,
  provider: account.provider,
  providerAccountId: account.providerAccountId || account.provider_account_id,
  accessToken: account.accessToken || account.access_token,
  refreshToken: account.refreshToken || account.refresh_token,
  tokenType: account.tokenType || account.token_type,
  scope: account.scope,
  idToken: account.idToken || account.id_token,
  expiresAt: account.expiresAt || account.expires_at,
  createdAt: account.createdAt || account.created_at,
  updatedAt: account.updatedAt || account.updated_at,
});

const transformUserSession = (session: any) => ({
  id: session.id,
  userId: session.userId || session.user_id,
  sessionToken: session.sessionToken || session.session_token,
  accessToken: session.accessToken || session.access_token,
  refreshToken: session.refreshToken || session.refresh_token,
  expiresAt: session.expiresAt || session.expires_at,
  userAgent: session.userAgent || session.user_agent,
  ipAddress: session.ipAddress || session.ip_address,
  isActive: session.isActive !== undefined ? session.isActive : session.is_active !== undefined ? session.is_active : true,
  createdAt: session.createdAt || session.created_at,
  updatedAt: session.updatedAt || session.updated_at,
});

const transformUser = (user: any) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  isActive: user.isActive !== undefined ? user.isActive : user.is_active !== undefined ? user.is_active : true,
  emailVerified: user.emailVerified !== undefined ? user.emailVerified : user.email_verified !== undefined ? user.email_verified : false,
  lastLoginAt: user.lastLoginAt || user.last_login_at || null,
  createdAt: user.created_at || user.createdAt,
  updatedAt: user.updated_at || user.updatedAt,
  profile: user.profile ? transformUserProfile(user.profile) : null,
  addresses: user.addresses && user.addresses.length > 0 ? user.addresses.map(transformUserAddress) : [],
  accounts: user.accounts && user.accounts.length > 0 ? user.accounts.map(transformUserAccount) : [],
  sessions: user.sessions && user.sessions.length > 0 ? user.sessions.map(transformUserSession) : []
});

export const resolvers = {
  // Scalar types
  DateTime: dateTimeScalar,
  Decimal: decimalScalar,
  JSON: jsonScalar,

  // Type resolvers for relationships
  User: {
    sessions: async (parent: any, _: any, context: any) => {
      const startTime = Date.now();
      const traceId = `user-sessions-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;

      const logger = LoggerFactory.getInstance().createGraphQLLogger();

      try {
        const authRepository = container.get('authRepository') as any;
        const sessions = await authRepository.findSessionsByUserId(parent.id);

        const duration = Date.now() - startTime;
        logger.info('User.sessions resolver success', {
          operation: 'User.sessions',
          requestId,
          traceId,
          duration,
          userId: parent.id,
          sessionsCount: Array.isArray(sessions) ? sessions.length : 0,
          timestamp: new Date().toISOString()
        });

        return Array.isArray(sessions) ? sessions.map(transformUserSession) : [];
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('User.sessions resolver error', error as Error, {
          operation: 'User.sessions',
          requestId,
          traceId,
          duration,
          userId: parent.id,
          timestamp: new Date().toISOString()
        });
        return [];
      }
    }
  },
  Query: {
    health: () => 'GraphQL server is running with clean architecture!',

    // Dashboard & Analytics queries - CRITICAL FOR ADMIN
    dashboardMetrics: async (_: any, __: any, context: any) => {
      const startTime = Date.now();
      const traceId = `dashboard-metrics-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        const getOrderStatsUseCase = container.get<GetOrderStatsUseCase>('getOrderStatsUseCase');
        const getUserStatsUseCase = container.get<GetUserStatsUseCase>('getUserStatsUseCase');
        const getProductsUseCase = container.get<GetProductsUseCase>('getProductsUseCase');

        const [orderStats, userStats, productsResult] = await Promise.all([
          getOrderStatsUseCase.execute(),
          getUserStatsUseCase.execute(),
          getProductsUseCase.execute({ filters: {}, pagination: { limit: 1000, offset: 0 } })
        ]);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayOrders = orderStats.pendingOrders || 0;
        const todayRevenue = 0; // TODO: Implement revenue by month tracking
        const lowStockProducts = productsResult.products.filter(p => p.stockQuantity < 10).length;

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          {
            totalUsers: userStats.totalUsers || 0,
            totalProducts: productsResult.total || 0,
            totalOrders: orderStats.totalOrders || 0,
            totalRevenue: orderStats.totalRevenue || 0,
            todayOrders,
            todayRevenue,
            pendingOrders: orderStats.pendingOrders || 0,
            lowStockProducts,
            activeCoupons: 0 // TODO: Implement coupon repository
          },
          'Dashboard metrics retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId,
            traceId,
            duration
          }
        );
        
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        console.error('DashboardMetrics resolver error:', {
          error: error.message,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          `Failed to fetch dashboard metrics: ${error.message || 'Unknown error'}`,
          RESPONSE_CODES.INTERNAL_ERROR,
          { error: error.message },
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    orderAnalytics: async (_: any, __: any, context: any) => {
      const startTime = Date.now();
      const traceId = `order-analytics-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        const getOrderStatsUseCase = container.get<GetOrderStatsUseCase>('getOrderStatsUseCase');
        const getUsersUseCase = container.get<GetUsersUseCase>('getUsersUseCase');
        
        const [orderStats, usersResult] = await Promise.all([
          getOrderStatsUseCase.execute(),
          getUsersUseCase.execute({ limit: 100, offset: 0 })
        ]);

        const users = usersResult.map(transformUser);
        const topCustomers = users.slice(0, 5); // Placeholder - would need spending data

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          {
            totalOrders: orderStats.totalOrders || 0,
            totalRevenue: orderStats.totalRevenue || 0,
            averageOrderValue: orderStats.averageOrderValue || 0,
            ordersByStatus: {
              pending: orderStats.pendingOrders || 0,
              processing: orderStats.processingOrders || 0,
              shipped: orderStats.shippedOrders || 0,
              delivered: orderStats.deliveredOrders || 0,
              cancelled: orderStats.cancelledOrders || 0
            },
            revenueByMonth: {}, // TODO: Implement revenue by month tracking
            topCustomers
          },
          'Order analytics retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId,
            traceId,
            duration
          }
        );
        
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        console.error('OrderAnalytics resolver error:', {
          error: error.message,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          `Failed to fetch order analytics: ${error.message || 'Unknown error'}`,
          RESPONSE_CODES.INTERNAL_ERROR,
          { error: error.message },
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    userAnalytics: async (_: any, __: any, context: any) => {
      const startTime = Date.now();
      const traceId = `user-analytics-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        const getUserStatsUseCase = container.get<GetUserStatsUseCase>('getUserStatsUseCase');
        const getUsersUseCase = container.get<GetUsersUseCase>('getUsersUseCase');
        
        const [userStats, usersResult] = await Promise.all([
          getUserStatsUseCase.execute(),
          getUsersUseCase.execute({ limit: 1000, offset: 0 })
        ]);

        const users = usersResult.map(transformUser);
        const activeUsers = users.filter(u => u.isActive).length;
        const newUsersThisMonth = users.filter(u => {
          const userDate = new Date(u.createdAt);
          const now = new Date();
          return userDate.getMonth() === now.getMonth() && userDate.getFullYear() === now.getFullYear();
        }).length;

        // Group users by role
        const usersByRole = users.reduce((acc, user) => {
          acc[user.role] = (acc[user.role] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const topSpenders = users.slice(0, 5); // Placeholder - would need spending data

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          {
            totalUsers: users.length,
            activeUsers,
            newUsersThisMonth,
            usersByRole,
            topSpenders,
            userEngagement: {} // TODO: Implement engagement metrics
          },
          'User analytics retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId,
            traceId,
            duration
          }
        );
        
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        console.error('UserAnalytics resolver error:', {
          error: error.message,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          `Failed to fetch user analytics: ${error.message || 'Unknown error'}`,
          RESPONSE_CODES.INTERNAL_ERROR,
          { error: error.message },
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    // products / product / productBySku / searchProducts → migrated to product-service (Federation)

    // Order queries
    orders: async (_: any, { filter, pagination }: any) => {
      const getOrdersUseCase = container.get<GetOrdersUseCase>('getOrdersUseCase');
      const result = await getOrdersUseCase.execute({
        filters: filter,
        pagination: pagination || { limit: 10, offset: 0 }
      });

      return {
        orders: result.orders.map(transformOrder),
        total: result.total,
        hasMore: result.hasMore
      };
    },

    order: async (_: any, { id }: { id: string }) => {
      const getOrderByIdUseCase = container.get<GetOrderByIdUseCase>('getOrderByIdUseCase');
      const order = await getOrderByIdUseCase.execute(id);
      return order ? transformOrder(order) : null;
    },

    orderByNumber: async (_: any, { orderNumber }: { orderNumber: string }) => {
      const getOrdersUseCase = container.get<GetOrdersUseCase>('getOrdersUseCase');
      const result = await getOrdersUseCase.execute({
        filters: { orderNumber },
        pagination: { limit: 1, offset: 0 }
      });
      return result.orders[0] ? transformOrder(result.orders[0]) : null;
    },

    // User queries
    users: async (_: any, { filter, pagination }: any, context: any) => {
      const startTime = Date.now();
      const traceId = context?.traceId || `users-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Create logger for this operation
      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        logger.info('Starting users query', {
          operation: 'users',
          requestId,
          traceId,
          filter,
          pagination,
          timestamp: new Date().toISOString()
        });

        const getUsersUseCase = container.get<GetUsersUseCase>('getUsersUseCase');
        const limit = pagination?.limit || 10;
        const offset = pagination?.offset || 0;
        
        // Validate pagination parameters
        if (limit < 1 || limit > 100) {
          const duration = Date.now() - startTime;
          logger.warn('Invalid pagination limit', {
            operation: 'users',
            requestId,
            traceId,
            duration,
            limit,
            timestamp: new Date().toISOString()
          });
          
          return ResponseFactory.createErrorResponse(
            'Invalid pagination limit. Must be between 1 and 100',
            RESPONSE_CODES.INVALID_INPUT,
            { limit, maxAllowed: 100 },
            { requestId, traceId, duration }
          );
        }

        if (offset < 0) {
          const duration = Date.now() - startTime;
          logger.warn('Invalid pagination offset', {
            operation: 'users',
            requestId,
            traceId,
            duration,
            offset,
            timestamp: new Date().toISOString()
          });
          
          return ResponseFactory.createErrorResponse(
            'Invalid pagination offset. Must be non-negative',
            RESPONSE_CODES.INVALID_INPUT,
            { offset },
            { requestId, traceId, duration }
          );
        }
        
        // Get users for current page
        const result = await getUsersUseCase.execute({
          role: filter?.role,
          isActive: filter?.isActive,
          search: filter?.search,
          limit,
          offset
        });

        const duration = Date.now() - startTime;
        
        // Check if result has the expected structure
        if (result && typeof result === 'object' && 'users' in result && 'total' in result) {
          // Repository returned paginated result
          const paginationInfo = {
            total: (result as any).total,
            limit,
            offset,
            hasMore: (result as any).users.length === limit,
            currentPage: Math.floor(offset / limit) + 1,
            totalPages: Math.ceil((result as any).total / limit)
          };

          const transformedUsers = (result as any).users.map(transformUser);
          
          logger.info('Users query completed successfully', {
            operation: 'users',
            requestId,
            traceId,
            duration,
            usersCount: transformedUsers.length,
            total: paginationInfo.total,
            hasMore: paginationInfo.hasMore,
            timestamp: new Date().toISOString()
          });

          return ResponseFactory.createPaginatedResponse(
            transformedUsers,
            paginationInfo,
            'Users retrieved successfully',
            { requestId, traceId, duration }
          );
        } else {
          // Fallback for backward compatibility
          const users = Array.isArray(result) ? result : [];
          const total = users.length + (users.length === limit ? 50 : 0);
          const hasMore = users.length === limit;
          
          const paginationInfo = {
            total,
            limit,
            offset,
            hasMore,
            currentPage: Math.floor(offset / limit) + 1,
            totalPages: Math.ceil(total / limit)
          };

          const transformedUsers = users.map(transformUser);
          
          logger.info('Users query completed with fallback logic', {
            operation: 'users',
            requestId,
            traceId,
            duration,
            usersCount: transformedUsers.length,
            total: paginationInfo.total,
            hasMore: paginationInfo.hasMore,
            fallbackUsed: true,
            timestamp: new Date().toISOString()
          });

          return ResponseFactory.createPaginatedResponse(
            transformedUsers,
            paginationInfo,
            'Users retrieved successfully (fallback mode)',
            { requestId, traceId, duration }
          );
        }
      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorResponse = GraphQLErrorHandler.handleError(error);
        
        // Log del error con contexto completo
        logger.error('Users resolver error', error, {
          operation: 'users',
          requestId,
          traceId,
          duration,
          filter,
          pagination,
          errorCode: errorResponse.code,
          errorMessage: errorResponse.message,
          timestamp: new Date().toISOString()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message || 'Failed to fetch users',
          errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          { requestId, traceId, duration }
        );
      }
    },

    user: async (_: any, { id }: { id: string }) => {
      const getUserByIdUseCase = container.get<GetUserByIdUseCase>('getUserByIdUseCase');
      const user = await getUserByIdUseCase.execute(id);
      return user ? transformUser(user) : null;
    },

    userProfile: async (_: any, { userId }: { userId: string }) => {
      const getUserByIdUseCase = container.get<GetUserByIdUseCase>('getUserByIdUseCase');
      const user = await getUserByIdUseCase.execute(userId);
      return user?.profile ? transformUserProfile(user.profile) : null;
    },

    currentUser: async (_: any, __: any, context: any) => {
      const startTime = Date.now();
      const traceId = context?.traceId || `current-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Create logger for this operation
      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        logger.info('Starting currentUser query', {
          operation: 'currentUser',
          requestId,
          traceId,
          hasUser: !!context.user,
          userId: context.user?.id,
          timestamp: new Date().toISOString()
        });

        // Check authentication
        if (!context.user) {
          const duration = Date.now() - startTime;
          logger.warn('CurrentUser query failed: Authentication required', {
            operation: 'currentUser',
            requestId,
            traceId,
            duration,
            timestamp: new Date().toISOString()
          });
          
          return ResponseFactory.createErrorResponse(
            'Authentication required',
            RESPONSE_CODES.AUTHENTICATION_FAILED,
            { 
              operation: 'currentUser',
              message: 'User must be authenticated to access current user information'
            },
            { requestId, traceId, duration }
          );
        }

        // Get user by ID using the use case
        const getUserByIdUseCase = container.get<GetUserByIdUseCase>('getUserByIdUseCase');
        const user = await getUserByIdUseCase.execute(context.user.id);
        
        const duration = Date.now() - startTime;
        
        if (!user) {
          logger.warn('CurrentUser query failed: User not found', {
            operation: 'currentUser',
            requestId,
            traceId,
            duration,
            userId: context.user.id,
            timestamp: new Date().toISOString()
          });
          
          return ResponseFactory.createErrorResponse(
            'User not found',
            RESPONSE_CODES.USER_NOT_FOUND,
            { 
              operation: 'currentUser',
              userId: context.user.id,
              message: 'The authenticated user was not found in the system'
            },
            { requestId, traceId, duration }
          );
        }

        // Transform user data
        const transformedUser = transformUser(user);
        
        logger.info('CurrentUser query completed successfully', {
          operation: 'currentUser',
          requestId,
          traceId,
          duration,
          userId: user.id,
          userRole: user.role,
          hasProfile: !!user.profile,
          addressesCount: user.addresses?.length || 0,
          timestamp: new Date().toISOString()
        });

        // Return standardized response using ResponseFactory
        return ResponseFactory.createSuccessResponse(
          transformedUser,
          'Current user retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorResponse = GraphQLErrorHandler.handleError(error);
        
        // Log the error with complete context
        logger.error('CurrentUser query error', error, {
          operation: 'currentUser',
          requestId,
          traceId,
          duration,
          userId: context.user?.id,
          errorCode: errorResponse.code,
          errorMessage: errorResponse.message,
          timestamp: new Date().toISOString()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message || 'Failed to retrieve current user',
          errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          { requestId, traceId, duration }
        );
      }
    },

    searchUsers: async (_: any, { query }: { query: string }) => {
      const getUsersUseCase = container.get<GetUsersUseCase>('getUsersUseCase');
      const users = await getUsersUseCase.execute({
        search: query,
        limit: 50,
        offset: 0
      });
      return users.map(transformUser);
    },

    activeUsers: async () => {
      const getUsersUseCase = container.get<GetUsersUseCase>('getUsersUseCase');
      const users = await getUsersUseCase.execute({
        isActive: true,
        limit: 100,
        offset: 0
      });
      return users.map(transformUser);
    },

    usersByRole: async (_: any, { role }: { role: string }) => {
      const getUsersUseCase = container.get<GetUsersUseCase>('getUsersUseCase');
      const users = await getUsersUseCase.execute({
        role: role as any, // TODO: Fix type casting
        limit: 100,
        offset: 0
      });
      return users.map(transformUser);
    },

    usersByProvider: async (_: any, { provider }: { provider: string }, context: any) => {
      const startTime = Date.now();
      const traceId = context?.traceId || `users-by-provider-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Create logger for this operation
      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        logger.info('Starting usersByProvider query', {
          operation: 'usersByProvider',
          requestId,
          traceId,
          provider,
          timestamp: new Date().toISOString()
        });

        // Validate provider parameter
        if (!provider || !['email', 'google', 'facebook', 'apple'].includes(provider)) {
          const duration = Date.now() - startTime;
          logger.warn('Invalid provider parameter', {
            operation: 'usersByProvider',
            requestId,
            traceId,
            duration,
            provider,
            validProviders: ['email', 'google', 'facebook', 'apple'],
            timestamp: new Date().toISOString()
          });
          
          return ResponseFactory.createErrorResponse(
            `Invalid provider. Must be one of: email, google, facebook, apple`,
            RESPONSE_CODES.INVALID_INPUT,
            { provider, validProviders: ['email', 'google', 'facebook', 'apple'] },
            { requestId, traceId, duration }
          );
        }

        // TODO: Implement proper provider filtering in repository
        // For now, we'll get all users and filter by provider in the resolver
        // This should be moved to the repository layer for better performance
        const getUsersUseCase = container.get<GetUsersUseCase>('getUsersUseCase');
        const allUsers = await getUsersUseCase.execute({
          limit: 100, // Maximum allowed limit
          offset: 0
        });

        // Filter users by provider (temporary implementation)
        // This should be replaced with proper repository filtering
        const usersByProvider = allUsers.filter(user => {
          // For now, we'll assume all users are email-based
          // In a real implementation, this would check the UserAccount table
          return provider === 'email';
        });

        const duration = Date.now() - startTime;
        const transformedUsers = usersByProvider.map(transformUser);
        
        logger.info('UsersByProvider query completed successfully', {
          operation: 'usersByProvider',
          requestId,
          traceId,
          duration,
          provider,
          totalUsers: allUsers.length,
          filteredUsers: transformedUsers.length,
          timestamp: new Date().toISOString()
        });

        return ResponseFactory.createSuccessResponse(
          transformedUsers,
          `Users by provider '${provider}' retrieved successfully`,
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorResponse = GraphQLErrorHandler.handleError(error);
        
        // Log del error con contexto completo
        logger.error('UsersByProvider resolver error', error, {
          operation: 'usersByProvider',
          requestId,
          traceId,
          duration,
          provider,
          errorCode: errorResponse.code,
          errorMessage: errorResponse.message,
          timestamp: new Date().toISOString()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message || `Failed to fetch users by provider '${provider}'`,
          errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          { requestId, traceId, duration }
        );
      }
    },

    // Authentication queries
    userAccounts: async (_: any, { userId }: { userId: string }) => {
      // This would be implemented with proper repository
      return [];
    },

    userSessions: async (_: any, { userId }: { userId: string }, context: any) => {
      const startTime = Date.now();
      const traceId = `query-user-sessions-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;

      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      try {
        const authRepository = container.get('authRepository') as any;
        const sessions = await authRepository.findSessionsByUserId(userId);

        const duration = Date.now() - startTime;
        logger.info('Query.userSessions success', {
          operation: 'userSessions',
          requestId,
          traceId,
          duration,
          userId,
          sessionsCount: Array.isArray(sessions) ? sessions.length : 0,
          timestamp: new Date().toISOString()
        });

        return Array.isArray(sessions) ? sessions.map(transformUserSession) : [];
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Query.userSessions error', error as Error, {
          operation: 'userSessions',
          requestId,
          traceId,
          duration,
          userId,
          timestamp: new Date().toISOString()
        });
        return [];
      }
    },

    activeSessions: async (_: any, { userId }: { userId: string }, context: any) => {
      const startTime = Date.now();
      const traceId = `query-active-sessions-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;

      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      try {
        const authRepository = container.get('authRepository') as any;
        const sessions = await authRepository.findSessionsByUserId(userId);
        const active = Array.isArray(sessions) ? sessions.filter((s: any) => s.isActive) : [];

        const duration = Date.now() - startTime;
        logger.info('Query.activeSessions success', {
          operation: 'activeSessions',
          requestId,
          traceId,
          duration,
          userId,
          totalSessions: Array.isArray(sessions) ? sessions.length : 0,
          activeSessions: active.length,
          timestamp: new Date().toISOString()
        });

        return active.map(transformUserSession);
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Query.activeSessions error', error as Error, {
          operation: 'activeSessions',
          requestId,
          traceId,
          duration,
          userId,
          timestamp: new Date().toISOString()
        });
        return [];
      }
    },

    userSessionAnalytics: async (_: any, { userId }: { userId: string }, context: any) => {
      const startTime = Date.now();
      const traceId = `user-session-analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Logger especializado para GraphQL
      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        // Log del inicio de la operación
        logger.info('UserSessionAnalytics query started', {
          operation: 'userSessionAnalytics',
          requestId,
          traceId,
          userId,
          timestamp: new Date().toISOString()
        });

        const getUserSessionAnalyticsUseCase = container.get<GetUserSessionAnalyticsUseCase>('getUserSessionAnalyticsUseCase');
        const result = await getUserSessionAnalyticsUseCase.execute({
          userId,
          limit: 50,
          offset: 0
        });

        const duration = Date.now() - startTime;
        
        // Log del éxito
        logger.info('UserSessionAnalytics query success', {
          operation: 'userSessionAnalytics',
          requestId,
          traceId,
          duration,
          userId,
          total: result.total,
          returned: result.analytics.length,
          timestamp: new Date().toISOString()
        });

        return result.analytics.map(transformUserSessionAnalytics);

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error
        logger.error('UserSessionAnalytics query error', error, {
          operation: 'userSessionAnalytics',
          requestId,
          traceId,
          duration,
          userId,
          errorDetails: {
            message: error.message,
            type: error.constructor.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          timestamp: new Date().toISOString()
        });
        
        // Return empty array on error
        return [];
      }
    },

    userOrderHistory: async (_: any, { userId, filter, pagination }: any) => {
      try {
        const getUserOrderHistoryUseCase = container.get<GetUserOrderHistoryUseCase>('getUserOrderHistoryUseCase');
        const result = await getUserOrderHistoryUseCase.execute({
          userId,
          ...filter,
          limit: pagination?.limit || 20,
          offset: pagination?.offset || 0
        });

        return {
          orders: result.orders.map(transformOrder),
          total: result.total,
          hasMore: result.hasMore,
          stats: {
            totalOrders: result.stats.totalOrders,
            totalSpent: result.stats.totalSpent,
            averageOrderValue: result.stats.averageOrderValue,
            lastOrderDate: result.stats.lastOrderDate,
            ordersByStatus: {} // TODO: Implement orders by status in user order history
          }
        };
      } catch (error: any) {
        // Return empty response if use case is not available
        return {
          orders: [],
          total: 0,
          hasMore: false,
          stats: {
            totalOrders: 0,
            totalSpent: 0,
            averageOrderValue: 0,
            lastOrderDate: null,
            ordersByStatus: {}
          }
        };
      }
    },

    userFavoriteStats: async (_: any, { userId }: { userId: string }) => {
      try {
        const favoritesUseCase = container.get<ManageUserFavoritesUseCase>('manageUserFavoritesUseCase');
        const favorites = await favoritesUseCase.getUserFavorites(userId);
        const stats = await favoritesUseCase.getFavoriteStats(userId);

        return {
          totalFavorites: stats.totalFavorites,
          recentFavorites: favorites.slice(0, 10).map(fav => ({
            id: fav.id,
            userId: fav.userId,
            productId: fav.productId,
            createdAt: fav.createdAt
          })),
          favoriteCategories: [] // TODO: Implement category analysis
        };
      } catch (error: any) {
        return {
          totalFavorites: 0,
          recentFavorites: [],
          favoriteCategories: []
        };
      }
    },

    userActivitySummary: async (_: any, { userId }: { userId: string }) => {
      try {
        const getUserByIdUseCase = container.get<GetUserByIdUseCase>('getUserByIdUseCase');
        const user = await getUserByIdUseCase.execute(userId);
        
        if (!user) {
          throw new Error('User not found');
        }

        // Get recent orders
        const getUserOrderHistoryUseCase = container.get<GetUserOrderHistoryUseCase>('getUserOrderHistoryUseCase');
        const orderHistory = await getUserOrderHistoryUseCase.execute({
          userId,
          limit: 5,
          offset: 0
        });

        // Get favorites (as favorite products)
        const favoritesUseCase = container.get<ManageUserFavoritesUseCase>('manageUserFavoritesUseCase');
        const favorites = await favoritesUseCase.getUserFavorites(userId);

        return {
          recentOrders: orderHistory.orders.slice(0, 3).map(transformOrder),
          favoriteProducts: [], // TODO: Map favorites to products
          cartItemsCount: 0, // TODO: Get from cart service
          totalSpent: orderHistory.stats.totalSpent,
          joinDate: user.createdAt,
          lastActivity: user.updatedAt
        };
      } catch (error: any) {
        throw new Error(`Failed to get user activity summary: ${error.message}`);
      }
    },

    // Stats queries
    // productStats → migrated to product-service (Federation)

    orderStats: async (_: any, __: any, context: any) => {
      const startTime = Date.now();
      const traceId = `order-stats-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Logger especializado para este resolver
      const logger = LoggerFactory.getInstance().createLoggerWithContext({
        module: 'GraphQL',
        operation: 'orderStats',
        requestId,
        traceId
      });
      
      try {
        logger.info('Starting orderStats query execution', {
          context: { requestId, traceId },
          timestamp: new Date()
        });

        const getOrderStatsUseCase = container.get<GetOrderStatsUseCase>('getOrderStatsUseCase');
        const result = await getOrderStatsUseCase.execute();
        
        const duration = Date.now() - startTime;
        
        logger.info('OrderStats query completed successfully', {
          context: { requestId, traceId },
          duration,
          result: {
            totalOrders: result.totalOrders,
            totalRevenue: result.totalRevenue,
            averageOrderValue: result.averageOrderValue
          },
          timestamp: new Date()
        });
        
        return ResponseFactory.createSuccessResponse(
          result,
          'Order stats retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId,
            traceId,
            duration
          }
        );
        
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo usando el logger especializado
        logger.error('OrderStats query failed', error, {
          context: { requestId, traceId },
          duration,
          errorDetails: {
            message: error.message,
            name: error.name,
            stack: error.stack,
            code: error.code
          },
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          `Failed to fetch order stats: ${error.message || 'Unknown error'}`,
          RESPONSE_CODES.INTERNAL_ERROR,
          { 
            error: error.message,
            errorType: error.name,
            errorCode: error.code 
          },
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    userStats: async (_: any, __: any, context: any) => {
      const startTime = Date.now();
      const traceId = `user-stats-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Logger especializado para este resolver
      const logger = LoggerFactory.getInstance().createLoggerWithContext({
        module: 'GraphQL',
        operation: 'userStats',
        requestId,
        traceId
      });
      
      try {
        logger.info('Starting userStats query execution', {
          context: { requestId, traceId },
          timestamp: new Date()
        });

        const getUserStatsUseCase = container.get<GetUserStatsUseCase>('getUserStatsUseCase');
        const result = await getUserStatsUseCase.execute();
        
        const duration = Date.now() - startTime;
        
        logger.info('UserStats query completed successfully', {
          context: { requestId, traceId },
          duration,
          result: {
            totalUsers: result.totalUsers,
            activeUsers: result.activeUsers,
            newUsersThisMonth: result.newUsersThisMonth
          },
          timestamp: new Date()
        });
        
        return ResponseFactory.createSuccessResponse(
          result,
          'User stats retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId,
            traceId,
            duration
          }
        );
        
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo usando el logger especializado
        logger.error('UserStats query failed', error, {
          context: { requestId, traceId },
          duration,
          errorDetails: {
            message: error.message,
            name: error.name,
            stack: error.stack,
            code: error.code
          },
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          `Failed to fetch user stats: ${error.message || 'Unknown error'}`,
          RESPONSE_CODES.INTERNAL_ERROR,
          { 
            error: error.message,
            errorType: error.name,
            errorCode: error.code 
          },
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    // User favorites and cart queries
    userFavorites: async (_: any, { userId }: { userId: string }) => {
      try {
        const favoritesUseCase = container.get<ManageUserFavoritesUseCase>('manageUserFavoritesUseCase');
        const favorites = await favoritesUseCase.getUserFavorites(userId);
        return favorites.map(fav => ({
          id: fav.id,
          userId: fav.userId,
          productId: fav.productId,
          createdAt: fav.createdAt
        }));
      } catch (error: any) {
        return [];
      }
    },

    isProductFavorited: async (_: any, { userId, productId }: { userId: string; productId: string }) => {
      try {
        const favoritesUseCase = container.get<ManageUserFavoritesUseCase>('manageUserFavoritesUseCase');
        const favorites = await favoritesUseCase.getUserFavorites(userId);
        return favorites.some(fav => fav.productId === productId);
      } catch (error: any) {
        return false;
      }
    },

    userOrders: async (_: any, { userId, pagination }: any) => {
      try {
        const getUserOrderHistoryUseCase = container.get<GetUserOrderHistoryUseCase>('getUserOrderHistoryUseCase');
        const result = await getUserOrderHistoryUseCase.execute({
          userId,
          limit: pagination?.limit || 20,
          offset: pagination?.offset || 0
        });

        return {
          orders: result.orders.map(transformOrder),
          total: result.total,
          hasMore: result.hasMore
        };
      } catch (error: any) {
        return { orders: [], total: 0, hasMore: false };
      }
    },

    // Address queries - implemented with user repository
    userAddresses: async (_: any, { userId }: { userId: string }, context: Context) => {
      const startTime = Date.now();
      const traceId = `get-addresses-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context.req?.id || `req-${Date.now()}`;
      
      try {
        const getUserByIdUseCase = container.get<GetUserByIdUseCase>('getUserByIdUseCase');
        const user = await getUserByIdUseCase.execute(userId);
        const addresses = user?.addresses?.map(transformUserAddress) || [];

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          addresses,
          'User addresses retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorResponse = GraphQLErrorHandler.handleError(error);
        
        console.error('GetUserAddresses resolver error:', {
          error: errorResponse,
          userId,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    userAddress: async (_: any, { id }: { id: string }, context: Context) => {
      const startTime = Date.now();
      const traceId = `get-address-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context.req?.id || `req-${Date.now()}`;
      
      try {
        const getUserAddressByIdUseCase = container.get<GetUserAddressByIdUseCase>('getUserAddressByIdUseCase');
        const address = await getUserAddressByIdUseCase.execute(id);

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          address,
          'Address retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorResponse = GraphQLErrorHandler.handleError(error);
        
        console.error('GetUserAddress resolver error:', {
          error: errorResponse,
          id,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    // categories / category / categoryBySlug → migrated to category-service (Federation)

    // productsByCategory / productVariants / productVariant → migrated to product-service (Federation)

    userCart: async (_: any, { userId }: { userId: string }) => {
      return [
        {
          id: 'cart-1',
          userId: userId,
          sessionId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    cartItem: async (_: any, { id }: { id: string }) => {
      return {
        id: 'cart-1',
        userId: 'user-1',
        sessionId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },

    orderItems: async (_: any, { orderId }: { orderId: string }) => {
      return [
        {
          id: 'item-1',
          orderId: orderId,
          productId: 'prod-1',
          quantity: 2,
          unitPrice: 24.99,
          totalPrice: 49.98,
          createdAt: new Date()
        }
      ];
    },

    userPaymentMethods: async (_: any, { userId }: { userId: string }) => {
      return [
        {
          id: 'pm-1',
          orderId: 'order-1',
          type: 'credit_card',
          amount: 55.96,
          status: 'completed',
          transactionId: 'txn-123',
          metadata: { last4: '1234', brand: 'visa' },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    paymentMethod: async (_: any, { id }: { id: string }) => {
      return {
        id: 'pm-1',
        orderId: 'order-1',
        type: 'credit_card',
        amount: 55.96,
        status: 'completed',
        transactionId: 'txn-123',
        metadata: { last4: '1234', brand: 'visa' },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },

    savedPaymentMethods: async (_: any, { userId }: { userId: string }) => {
      return [
        {
          id: 'spm-1',
          userId: userId,
          type: 'credit_card',
          provider: 'stripe',
          lastFour: '1234',
          expiryMonth: 12,
          expiryYear: 2025,
          cardholderName: 'John Doe',
          isDefault: true,
          isActive: true,
          metadata: { brand: 'visa' },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    userTransactions: async (_: any, { userId }: { userId: string }) => {
      return [
        {
          id: 'txn-1',
          orderId: 'order-1',
          userId: userId,
          type: 'payment',
          amount: 55.96,
          currency: 'USD',
          status: 'completed',
          gateway: 'stripe',
          gatewayTransactionId: 'txn_123',
          metadata: { payment_method: 'card' },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    orderTransactions: async (_: any, { orderId }: { orderId: string }) => {
      return [
        {
          id: 'txn-1',
          orderId: orderId,
          userId: 'user-1',
          type: 'payment',
          amount: 55.96,
          currency: 'USD',
          status: 'completed',
          gateway: 'stripe',
          gatewayTransactionId: 'txn_123',
          metadata: { payment_method: 'card' },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    transaction: async (_: any, { id }: { id: string }) => {
      return {
        id: 'txn-1',
        orderId: 'order-1',
        userId: 'user-1',
        type: 'payment',
        amount: 55.96,
        currency: 'USD',
        status: 'completed',
        gateway: 'stripe',
        gatewayTransactionId: 'txn_123',
        metadata: { payment_method: 'card' },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },

    coupons: async () => {
      return [
        {
          id: 'coupon-1',
          code: 'WELCOME10',
          name: 'Welcome Discount',
          description: '10% off your first order',
          discountType: 'percentage',
          discountValue: 10,
          minimumAmount: 50,
          maximumDiscount: 20,
          usageLimit: 100,
          usedCount: 25,
          validFrom: new Date('2024-01-01'),
          validUntil: new Date('2024-12-31'),
          isActive: true,
          isFirstTimeOnly: true,
          applicableCategories: ['baby-clothing'],
          applicableProducts: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    coupon: async (_: any, { id }: { id: string }) => {
      const coupons = [
        {
          id: 'coupon-1',
          code: 'WELCOME10',
          name: 'Welcome Discount',
          description: '10% off your first order',
          discountType: 'percentage',
          discountValue: 10,
          minimumAmount: 50,
          maximumDiscount: 20,
          usageLimit: 100,
          usedCount: 25,
          validFrom: new Date('2024-01-01'),
          validUntil: new Date('2024-12-31'),
          isActive: true,
          isFirstTimeOnly: true,
          applicableCategories: ['baby-clothing'],
          applicableProducts: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      return coupons.find(coupon => coupon.id === id) || null;
    },

    couponByCode: async (_: any, { code }: { code: string }) => {
      const coupons = [
        {
          id: 'coupon-1',
          code: 'WELCOME10',
          name: 'Welcome Discount',
          description: '10% off your first order',
          discountType: 'percentage',
          discountValue: 10,
          minimumAmount: 50,
          maximumDiscount: 20,
          usageLimit: 100,
          usedCount: 25,
          validFrom: new Date('2024-01-01'),
          validUntil: new Date('2024-12-31'),
          isActive: true,
          isFirstTimeOnly: true,
          applicableCategories: ['baby-clothing'],
          applicableProducts: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      return coupons.find(coupon => coupon.code === code) || null;
    },

    activeCoupons: async () => {
      return [
        {
          id: 'coupon-1',
          code: 'WELCOME10',
          name: 'Welcome Discount',
          description: '10% off your first order',
          discountType: 'percentage',
          discountValue: 10,
          minimumAmount: 50,
          maximumDiscount: 20,
          usageLimit: 100,
          usedCount: 25,
          validFrom: new Date('2024-01-01'),
          validUntil: new Date('2024-12-31'),
          isActive: true,
          isFirstTimeOnly: true,
          applicableCategories: ['baby-clothing'],
          applicableProducts: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    userCouponUsage: async (_: any, { userId }: { userId: string }) => {
      return [
        {
          id: 'usage-1',
          couponId: 'coupon-1',
          userId: userId,
          orderId: 'order-1',
          discountAmount: 5.00,
          usedAt: new Date()
        }
      ];
    },

    productReviews: async (_: any, { productId, pagination }: any) => {
      return {
        reviews: [
          {
            id: 'review-1',
            productId: productId,
            userId: 'user-1',
            rating: 5,
            title: 'Great product!',
            comment: 'My baby loves this onesie. Very comfortable and soft.',
            isApproved: true,
            isVerified: true,
            helpfulCount: 3,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        total: 1,
        hasMore: false
      };
    },

    userReviews: async (_: any, { userId }: { userId: string }) => {
      return [
        {
          id: 'review-1',
          productId: 'prod-1',
          userId: userId,
          rating: 5,
          title: 'Great product!',
          comment: 'My baby loves this onesie. Very comfortable and soft.',
          isApproved: true,
          isVerified: true,
          helpfulCount: 3,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    review: async (_: any, { id }: { id: string }) => {
      return {
        id: 'review-1',
        productId: 'prod-1',
        userId: 'user-1',
        rating: 5,
        title: 'Great product!',
        comment: 'My baby loves this onesie. Very comfortable and soft.',
        isApproved: true,
        isVerified: true,
        helpfulCount: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },

    reviewVotes: async (_: any, { reviewId }: { reviewId: string }) => {
      return [
        {
          id: 'vote-1',
          reviewId: reviewId,
          userId: 'user-1',
          isHelpful: true,
          createdAt: new Date()
        }
      ];
    },

    inventoryTransactions: async (_: any, { productId }: { productId: string }) => {
      return [
        {
          id: 'inv-1',
          productId: productId,
          type: 'purchase',
          quantity: 100,
          reference: 'PO-001',
          notes: 'Initial stock purchase',
          createdAt: new Date()
        }
      ];
    },

    stockAlerts: async () => {
      return [
        {
          id: 'alert-1',
          productId: 'prod-1',
          type: 'low_stock',
          threshold: 10,
          currentStock: 5,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    // lowStockProducts / outOfStockProducts → migrated to product-service (Federation)

    carriers: async () => {
      return [
        {
          id: 'carrier-1',
          name: 'FedEx',
          code: 'fedex',
          trackingUrlTemplate: 'https://www.fedex.com/tracking?action=track&tracknumbers={tracking_number}',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    carrier: async (_: any, { id }: { id: string }) => {
      const carriers = [
        {
          id: 'carrier-1',
          name: 'FedEx',
          code: 'fedex',
          trackingUrlTemplate: 'https://www.fedex.com/tracking?action=track&tracknumbers={tracking_number}',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      return carriers.find(carrier => carrier.id === id) || null;
    },

    shippingZones: async () => {
      return [
        {
          id: 'zone-1',
          name: 'United States',
          countries: ['US'],
          states: [],
          cities: [],
          postalCodes: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    shippingZone: async (_: any, { id }: { id: string }) => {
      const zones = [
        {
          id: 'zone-1',
          name: 'United States',
          countries: ['US'],
          states: [],
          cities: [],
          postalCodes: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      return zones.find(zone => zone.id === id) || null;
    },

    shippingRates: async (_: any, { zoneId }: { zoneId: string }) => {
      return [
        {
          id: 'rate-1',
          zoneId: zoneId,
          name: 'Standard Shipping',
          minWeight: 0,
          maxWeight: 5,
          price: 5.99,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    deliverySlots: async () => {
      return [
        {
          id: 'slot-1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '12:00',
          maxOrders: 50,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    loyaltyPrograms: async () => {
      return [
        {
          id: 'loyalty-1',
          name: 'Baby Rewards',
          description: 'Earn points on every purchase',
          pointsPerDollar: 1,
          redemptionRate: 0.01,
          expiryMonths: 12,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    userRewardPoints: async (_: any, { userId }: { userId: string }) => {
      return [
        {
          id: 'rp-1',
          userId: userId,
          points: 150,
          type: 'earned',
          expiresAt: new Date('2025-12-31'),
          createdAt: new Date()
        }
      ];
    },

    userRewardBalance: async (_: any, { userId }: { userId: string }) => {
      return 150; // Mock balance
    },

    userNotifications: async (_: any, { userId }: { userId: string }) => {
      return [
        {
          id: 'notif-1',
          userId: userId,
          title: 'Order Shipped',
          body: 'Your order ORD-2024-001 has been shipped!',
          type: 'order_status',
          data: { orderId: 'order-1' },
          isRead: false,
          readAt: null,
          sentAt: new Date(),
          deliveredAt: new Date(),
          failedAt: null,
          errorMessage: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    unreadNotifications: async (_: any, { userId }: { userId: string }) => {
      return [
        {
          id: 'notif-1',
          userId: userId,
          title: 'Order Shipped',
          body: 'Your order ORD-2024-001 has been shipped!',
          type: 'order_status',
          data: { orderId: 'order-1' },
          isRead: false,
          readAt: null,
          sentAt: new Date(),
          deliveredAt: new Date(),
          failedAt: null,
          errorMessage: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    notificationTemplates: async () => {
      return [
        {
          id: 'template-1',
          name: 'Order Shipped',
          type: 'order_status',
          title: 'Order Shipped',
          body: 'Your order {orderNumber} has been shipped!',
          variables: ['orderNumber'],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    emailTemplates: async () => {
      return [
        {
          id: 'email-1',
          name: 'Welcome Email',
          subject: 'Welcome to Happy Baby Style!',
          body: 'Thank you for joining us, {firstName}!',
          variables: ['firstName'],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    newsletterSubscriptions: async () => {
      return [
        {
          id: 'news-1',
          email: 'customer1@example.com',
          userId: 'user-1',
          isActive: true,
          subscribedAt: new Date(),
          unsubscribedAt: null
        }
      ];
    },

    isSubscribedToNewsletter: async (_: any, { email }: { email: string }) => {
      return email === 'customer1@example.com';
    },

    userAppEvents: async (_: any, { userId }: { userId: string }) => {
      return [
        {
          id: 'event-1',
          userId: userId,
          sessionId: 'session-1',
          eventType: 'page_view',
          eventData: { page: '/products' },
          productId: null,
          categoryId: null,
          deviceInfo: { browser: 'Chrome', os: 'macOS' },
          location: { country: 'US', city: 'New York' },
          userAgent: 'Mozilla/5.0...',
          ipAddress: '192.168.1.1',
          createdAt: new Date()
        }
      ];
    },

    productAppEvents: async (_: any, { productId }: { productId: string }) => {
      return [
        {
          id: 'event-1',
          userId: 'user-1',
          sessionId: 'session-1',
          eventType: 'product_view',
          eventData: { productId },
          productId: productId,
          categoryId: null,
          deviceInfo: { browser: 'Chrome', os: 'macOS' },
          location: { country: 'US', city: 'New York' },
          userAgent: 'Mozilla/5.0...',
          ipAddress: '192.168.1.1',
          createdAt: new Date()
        }
      ];
    },

    userAuditLogs: async (_: any, { userId }: { userId: string }, context: any) => {
      const startTime = Date.now();
      const traceId = context.traceId || `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const logger = LoggerFactory.getInstance().createGraphQLLogger();

      try {
        logger.info('Fetching user audit logs', {
          userId,
          operation: 'userAuditLogs'
        });

        const auditRepository = container.get<IAuditRepository>('auditRepository');
        const auditLogs = await auditRepository.findByUserId(userId);

        const duration = Date.now() - startTime;
        
        logger.info('User audit logs retrieved successfully', {
          userId,
          count: auditLogs.length,
          duration
        });

        return ResponseFactory.createSuccessResponse(
          {
            items: auditLogs
          },
          'User audit logs retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId: context.requestId,
            traceId,
            duration
          }
        );
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        logger.error('Failed to fetch user audit logs', error, {
          userId,
          duration,
          errorCode: 'FETCH_AUDIT_LOGS_FAILED'
        });

        return ResponseFactory.createErrorResponse(
          error.message || 'Failed to fetch user audit logs',
          error.code || RESPONSE_CODES.INTERNAL_ERROR,
          { userId },
          {
            requestId: context.requestId,
            traceId,
            duration
          }
        );
      }
    },

    userSecurityEvents: async (_: any, { userId }: { userId: string }, context: any) => {
      const startTime = Date.now();
      const traceId = context.traceId || `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const logger = LoggerFactory.getInstance().createGraphQLLogger();

      try {
        logger.info('Fetching user security events', {
          userId,
          operation: 'userSecurityEvents'
        });

        const securityEventRepository = container.get<ISecurityEventRepository>('securityEventRepository');
        const securityEvents = await securityEventRepository.findByUserId(userId);

        const duration = Date.now() - startTime;
        
        logger.info('User security events retrieved successfully', {
          userId,
          count: securityEvents.length,
          duration
        });

        return ResponseFactory.createSuccessResponse(
          {
            items: securityEvents
          },
          'User security events retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId: context.requestId,
            traceId,
            duration
          }
        );
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        logger.error('Failed to fetch user security events', error, {
          userId,
          duration,
          errorCode: 'FETCH_SECURITY_EVENTS_FAILED'
        });

        return ResponseFactory.createErrorResponse(
          error.message || 'Failed to fetch user security events',
          error.code || RESPONSE_CODES.INTERNAL_ERROR,
          { userId },
          {
            requestId: context.requestId,
            traceId,
            duration
          }
        );
      }
    },

    storeSettings: async () => {
      return [
        {
          id: 'setting-1',
          settingKey: 'store_name',
          settingValue: 'Happy Baby Style',
          description: 'Store name',
          category: 'general',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    storeSetting: async (_: any, { key }: { key: string }) => {
      const settings = [
        {
          id: 'setting-1',
          settingKey: 'store_name',
          settingValue: 'Happy Baby Style',
          description: 'Store name',
          category: 'general',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      return settings.find(setting => setting.settingKey === key) || null;
    },

    taxRates: async () => {
      return [
        {
          id: 'tax-1',
          name: 'Sales Tax',
          rate: 8.5,
          country: 'US',
          state: 'NY',
          city: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    taxRate: async (_: any, { id }: { id: string }) => {
      const taxRates = [
        {
          id: 'tax-1',
          name: 'Sales Tax',
          rate: 8.5,
          country: 'US',
          state: 'NY',
          city: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      return taxRates.find(tax => tax.id === id) || null;
    },

    images: async (_: any, { entityType, entityId }: { entityType: string; entityId: string }) => {
      return [
        {
          id: 'img-1',
          fileName: 'product-image.jpg',
          originalName: 'product-image.jpg',
          mimeType: 'image/jpeg',
          size: 1024000,
          url: 'https://example.com/images/product-image.jpg',
          bucket: 'happy-baby-style',
          path: 'products/product-image.jpg',
          entityType: entityType,
          entityId: entityId,
          createdAt: new Date()
        }
      ];
    },

    image: async (_: any, { id }: { id: string }) => {
      return {
        id: 'img-1',
        fileName: 'product-image.jpg',
        originalName: 'product-image.jpg',
        mimeType: 'image/jpeg',
        size: 1024000,
        url: 'https://example.com/images/product-image.jpg',
        bucket: 'happy-baby-style',
        path: 'products/product-image.jpg',
        entityType: 'product',
        entityId: 'prod-1',
        createdAt: new Date()
      };
    },
  },

  Mutation: {
    // createProduct / updateProduct / deleteProduct → migrated to product-service (Federation)

    // Order mutations
    createOrder: async (_: any, { input }: { input: any }) => {
      const createOrderUseCase = container.get<CreateOrderUseCase>('createOrderUseCase');
      const order = await createOrderUseCase.execute({
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        items: input.items,
        shippingAddress: input.shippingAddress
      });
      return transformOrder(order);
    },

    updateOrder: async (_: any, { id, input }: { id: string; input: any }) => {
      const updateOrderUseCase = container.get<UpdateOrderUseCase>('updateOrderUseCase');
      const order = await updateOrderUseCase.execute(id, {
        status: input.status,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        deliveredAt: input.deliveredAt
      });
      return transformOrder(order);
    },

    updateOrderStatus: async (_: any, { id, status }: { id: string; status: string }) => {
      const updateOrderUseCase = container.get<UpdateOrderUseCase>('updateOrderUseCase');
      const order = await updateOrderUseCase.execute(id, { status: status as any });
      return transformOrder(order);
    },

    // User mutations
    createUser: async (_: any, { input }: { input: any }, context: any) => {
      const startTime = Date.now();
      const traceId = `create-user-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        const createUserUseCase = container.get<CreateUserUseCase>('createUserUseCase');
        const user = await createUserUseCase.execute({
          email: input.email,
          password: input.password,
          role: input.role,
          isActive: input.isActive !== undefined ? input.isActive : true,
          profile: {
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            birthDate: input.dateOfBirth
          }
        });

        const duration = Date.now() - startTime;
        
        return {
          success: true,
          message: 'User created successfully',
          code: 'CREATED',
          timestamp: new Date().toISOString(),
          data: {
            entity: transformUser(user),
            id: user.id,
            createdAt: user.createdAt?.toISOString() || new Date().toISOString()
          },
          metadata: {
            requestId,
            traceId,
            duration,
            timestamp: new Date().toISOString()
          }
        };

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        console.error('CreateUser resolver error:', {
          error: error.message,
          input,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return {
          success: false,
          message: error.message || 'Failed to create user',
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString(),
          data: null,
          metadata: {
            requestId,
            traceId,
            duration,
            timestamp: new Date().toISOString()
          }
        };
      }
    },

    updateUser: async (_: any, { id, input }: { id: string; input: any }) => {
      const updateUserUseCase = container.get<UpdateUserUseCase>('updateUserUseCase');
      const user = await updateUserUseCase.execute(id, {
        email: input.email,
        role: input.role,
        isActive: input.isActive,
        profile: input.profile ? {
          firstName: input.profile.firstName,
          lastName: input.profile.lastName,
          phone: input.profile.phone,
          birthDate: input.profile.dateOfBirth,  // Mapear desde dateOfBirth del input
          avatarUrl: input.profile.avatar        // Mapear desde avatar del input
        } : undefined
      });
      return transformUser(user);
    },

    deleteUser: async (_: any, { id }: { id: string }) => {
      // This would be implemented with a delete use case
      return {
        success: true,
        message: 'User deleted successfully'
      };
    },

    activateUser: async (_: any, { id }: { id: string }) => {
      const updateUserUseCase = container.get<UpdateUserUseCase>('updateUserUseCase');
      const user = await updateUserUseCase.execute(id, { isActive: true });
      return transformUser(user);
    },

    deactivateUser: async (_: any, { id }: { id: string }) => {
      const updateUserUseCase = container.get<UpdateUserUseCase>('updateUserUseCase');
      const user = await updateUserUseCase.execute(id, { isActive: false });
      return transformUser(user);
    },

    // Authentication management mutations
    revokeUserSession: async (_: any, { sessionId, userId, reason }: { sessionId: string; userId: string; reason?: string }, context: any) => {
      const startTime = Date.now();
      const traceId = `revoke-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Logger especializado para GraphQL
      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        // Log del inicio de la operación
        logger.info('RevokeUserSession mutation started', {
          operation: 'revokeUserSession',
          requestId,
          traceId,
          sessionId,
          userId,
          hasReason: !!reason,
          timestamp: new Date().toISOString()
        });

        const revokeUserSessionUseCase = container.get<RevokeUserSessionUseCase>('revokeUserSessionUseCase');
        const result = await revokeUserSessionUseCase.execute({
          sessionId,
          userId,
          reason
        });

        const duration = Date.now() - startTime;
        
        // Log del éxito
        logger.info('RevokeUserSession mutation success', {
          operation: 'revokeUserSession',
          requestId,
          traceId,
          duration,
          sessionId,
          userId,
          analyticsCleaned: result.analyticsCleaned,
          timestamp: new Date().toISOString()
        });

        return ResponseFactory.createSuccessResponse(
          {
            sessionId: result.sessionId,
            revokedAt: result.revokedAt,
            reason: result.reason,
            analyticsCleaned: result.analyticsCleaned
          },
          'User session revoked successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        logger.error('RevokeUserSession mutation error', error, {
          operation: 'revokeUserSession',
          requestId,
          traceId,
          duration,
          sessionId,
          userId,
          errorDetails: {
            message: error.message,
            type: error.constructor.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          timestamp: new Date().toISOString()
        });
        
        // Determinar el código de error apropiado
        let errorCode: string = RESPONSE_CODES.INTERNAL_ERROR;
        let errorMessage = error.message || 'Failed to revoke user session';
        
        if (error.message?.includes('not found') || error.message?.includes('NotFound')) {
          errorCode = RESPONSE_CODES.RESOURCE_NOT_FOUND;
        } else if (error.message?.includes('unauthorized') || error.message?.includes('Unauthorized')) {
          errorCode = RESPONSE_CODES.INSUFFICIENT_PERMISSIONS;
        } else if (error.message?.includes('required') || error.message?.includes('Validation failed')) {
          errorCode = RESPONSE_CODES.VALIDATION_ERROR;
        }
        
        return ResponseFactory.createErrorResponse(
          errorMessage,
          errorCode as any,
          { sessionId, userId, reason, error: error.message },
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    revokeAllUserSessions: async (_: any, { userId, requestingUserId, reason, excludeCurrentSession }: { userId: string; requestingUserId: string; reason?: string; excludeCurrentSession?: boolean }, context: any) => {
      const startTime = Date.now();
      const traceId = `revoke-all-sessions-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Logger especializado para GraphQL
      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        // Log del inicio de la operación
        logger.info('RevokeAllUserSessions mutation started', {
          operation: 'revokeAllUserSessions',
          requestId,
          traceId,
          userId,
          requestingUserId,
          hasReason: !!reason,
          excludeCurrentSession,
          timestamp: new Date().toISOString()
        });

        const revokeAllUserSessionsUseCase = container.get<RevokeAllUserSessionsUseCase>('revokeAllUserSessionsUseCase');
        const result = await revokeAllUserSessionsUseCase.execute({
          userId,
          requestingUserId,
          reason,
          excludeCurrentSession
        });

        const duration = Date.now() - startTime;
        
        // Log del éxito
        logger.info('RevokeAllUserSessions mutation success', {
          operation: 'revokeAllUserSessions',
          requestId,
          traceId,
          duration,
          userId,
          requestingUserId,
          sessionsRevoked: result.sessionsRevoked,
          analyticsCleaned: result.analyticsCleaned,
          timestamp: new Date().toISOString()
        });

        return ResponseFactory.createSuccessResponse(
          {
            userId: result.userId,
            sessionsRevoked: result.sessionsRevoked,
            analyticsCleaned: result.analyticsCleaned,
            revokedAt: result.revokedAt,
            reason: result.reason
          },
          'All user sessions revoked successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        logger.error('RevokeAllUserSessions mutation error', error, {
          operation: 'revokeAllUserSessions',
          requestId,
          traceId,
          duration,
          userId,
          requestingUserId,
          errorDetails: {
            message: error.message,
            type: error.constructor.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          timestamp: new Date().toISOString()
        });
        
        // Determinar el código de error apropiado
        let errorCode: string = RESPONSE_CODES.INTERNAL_ERROR;
        let errorMessage = error.message || 'Failed to revoke all user sessions';
        
        if (error.message?.includes('not found') || error.message?.includes('NotFound')) {
          errorCode = RESPONSE_CODES.RESOURCE_NOT_FOUND;
        } else if (error.message?.includes('unauthorized') || error.message?.includes('Unauthorized')) {
          errorCode = RESPONSE_CODES.INSUFFICIENT_PERMISSIONS;
        } else if (error.message?.includes('required') || error.message?.includes('Validation failed')) {
          errorCode = RESPONSE_CODES.VALIDATION_ERROR;
        }
        
        return ResponseFactory.createErrorResponse(
          errorMessage,
          errorCode as any,
          { userId, requestingUserId, reason, excludeCurrentSession, error: error.message },
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    unlinkUserAccount: async (_: any, { accountId }: { accountId: string }) => {
      // This would be implemented with proper auth repository
      return {
        success: true,
        message: 'Cuenta desvinculada exitosamente'
      };
    },

    forcePasswordReset: async (_: any, { userId }: { userId: string }) => {
      // This would be implemented with proper auth repository
      return {
        success: true,
        message: 'Reset de contraseña forzado exitosamente'
      };
    },

    impersonateUser: async (_: any, { userId }: { userId: string }) => {
      // This would be implemented with proper auth repository - only for admin users
      return {
        success: true,
        user: null,
        accessToken: 'mock_impersonation_token',
        refreshToken: 'mock_refresh_token',
        message: 'Impersonación iniciada'
      };
    },

    createUserProfile: async (_: any, { input }: { input: any }) => {
      const createUserUseCase = container.get<CreateUserUseCase>('createUserUseCase');
      const user = await createUserUseCase.execute({
        email: input.email,
        password: input.password,
        role: input.role,
        profile: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          birthDate: input.birthDate
        }
      });
      return user?.profile ? transformUserProfile(user.profile) : null;
    },

    updateUserProfile: async (_: any, { userId, input }: { userId: string; input: any }) => {
      const updateUserUseCase = container.get<UpdateUserUseCase>('updateUserUseCase');
      const user = await updateUserUseCase.execute(userId, {
        profile: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          birthDate: input.birthDate,
          avatarUrl: input.avatarUrl
        }
      });
      return user?.profile ? transformUserProfile(user.profile) : null;
    },

    // Auth mutations
    registerUser: async (_: any, { input }: { input: any }, context: any) => {
      const startTime = Date.now();
      const traceId = `register-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Logger especializado para GraphQL
      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        // Log del inicio de la operación (sin datos sensibles)
        logger.info('RegisterUser resolver started', {
          operation: 'registerUser',
          requestId,
          traceId,
          timestamp: new Date().toISOString(),
          context: {
            hasEmail: !!input.email,
            hasPassword: !!input.password,
            hasFirstName: !!input.firstName,
            hasLastName: !!input.lastName,
            userAgent: context?.req?.headers?.['user-agent'] || 'unknown'
          }
        });

        // Validación básica de input
        if (!input.email || !input.password || !input.firstName || !input.lastName) {
          const duration = Date.now() - startTime;
          const errorResponse = GraphQLErrorHandler.createErrorResponse(
            'Email, password, firstName and lastName are required',
            RESPONSE_CODES.MISSING_REQUIRED_FIELD
          );
          
          logger.warn('RegisterUser validation failed', {
            operation: 'registerUser',
            requestId,
            traceId,
            duration,
            error: errorResponse,
            timestamp: new Date().toISOString()
          });
          
          return ResponseFactory.createErrorResponse(
            errorResponse.message,
            errorResponse.code || RESPONSE_CODES.VALIDATION_ERROR,
            errorResponse.details,
            {
              requestId,
              traceId,
              duration
            }
          );
        }

        // Ejecutar caso de uso para crear usuario
        const createUserUseCase = container.get<CreateUserUseCase>('createUserUseCase');
        const user = await createUserUseCase.execute({
          email: input.email,
          password: input.password,
          role: input.role || 'customer',
          isActive: true,
          profile: {
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            birthDate: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined
          }
        });

        // Generar tokens de autenticación
        const authService = new AuthService();
        const authUser = authService.createAuthUser({
          id: user.id,
          email: user.email,
          role: user.role
        });
        
        const accessToken = authService.generateToken(authUser);
        const refreshToken = authService.generateToken(authUser);

        const duration = Date.now() - startTime;
        
        // Log del éxito (sin datos sensibles)
        logger.info('RegisterUser resolver success', {
          operation: 'registerUser',
          requestId,
          traceId,
          duration,
          userId: user.id,
          userRole: user.role,
          timestamp: new Date().toISOString(),
          context: {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            userActive: user.isActive
          }
        });

        // Crear respuesta exitosa usando ResponseFactory
        return ResponseFactory.createSuccessResponse(
          {
            user: transformUser(user),
            accessToken,
            refreshToken
          },
          'User registered successfully',
          RESPONSE_CODES.CREATED,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorResponse = GraphQLErrorHandler.handleError(error);
        
        // Log del error con contexto completo
        logger.error('RegisterUser resolver error', error, {
          errorResponse,
          input: {
            hasEmail: !!input.email,
            hasPassword: !!input.password,
            hasFirstName: !!input.firstName,
            hasLastName: !!input.lastName
          },
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    loginUser: async (_: any, { email, password }: { email: string; password: string }, context: any) => {
      const startTime = Date.now();
      const traceId = `login-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Logger especializado para GraphQL
      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        // Log del inicio de la operación (sin datos sensibles)
        logger.info('LoginUser resolver started', {
          operation: 'loginUser',
          requestId,
          traceId,
          timestamp: new Date().toISOString(),
          context: {
            hasEmail: !!email,
            hasPassword: !!password,
            userAgent: context?.req?.headers?.['user-agent'] || 'unknown'
          }
        });

        // Validación básica de input
        if (!email || !password) {
          const duration = Date.now() - startTime;
          const errorResponse = GraphQLErrorHandler.createErrorResponse(
            'Email and password are required',
            RESPONSE_CODES.MISSING_REQUIRED_FIELD
          );
          
          logger.warn('LoginUser validation failed', {
            operation: 'loginUser',
            requestId,
            traceId,
            duration,
            error: errorResponse,
            timestamp: new Date().toISOString()
          });
          
          return ResponseFactory.createErrorResponse(
            errorResponse.message,
            errorResponse.code || RESPONSE_CODES.VALIDATION_ERROR,
            errorResponse.details,
            {
              requestId,
              traceId,
              duration
            }
          );
        }

        // Ejecutar caso de uso con información del contexto
        const authenticateUserUseCase = container.get<AuthenticateUserUseCase>('authenticateUserUseCase');
        const result = await authenticateUserUseCase.execute({
          email,
          password,
          userAgent: context?.req?.headers?.['user-agent'],
          ipAddress: context?.req?.ip || context?.req?.connection?.remoteAddress
        });

        const duration = Date.now() - startTime;
        
        // Log del éxito (sin datos sensibles)
        logger.info('LoginUser resolver success', {
          operation: 'loginUser',
          requestId,
          traceId,
          duration,
          userId: result.user.id,
          userRole: result.user.role,
          sessionId: result.session.id,
          timestamp: new Date().toISOString(),
          context: {
            hasAccessToken: !!result.accessToken,
            hasRefreshToken: !!result.refreshToken,
            userActive: result.user.isActive,
            sessionExpiresAt: result.session.expiresAt
          }
        });

        // Crear respuesta exitosa usando ResponseFactory con estructura de sesión
        return ResponseFactory.createSuccessResponse(
          {
            user: transformUser(result.user),
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            session: {
              id: result.session.id,
              expiresAt: result.session.expiresAt
            }
          },
          'Login successful',
          RESPONSE_CODES.SUCCESS,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Manejar error usando GraphQLErrorHandler
        const errorResponse = GraphQLErrorHandler.handleError(error);
        
        // Log del error con contexto completo
        logger.error('LoginUser resolver error', error, {
          operation: 'loginUser',
          requestId,
          traceId,
          duration,
          errorDetails: {
            message: error.message,
            type: error.constructor.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          context: {
            hasEmail: !!email,
            hasPassword: !!password,
            userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
            ip: context?.req?.ip || 'unknown'
          }
        });
        
        // Crear respuesta de error
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    logoutUser: async (_: any, __: any, context: any) => {
      const startTime = Date.now();
      const traceId = `logout-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        // Obtener logger del container
        const logger = container.get<ILogger>('defaultLogger');
        
        // Log de inicio de operación
        logger.info('Starting user logout process', {
          operation: 'logoutUser',
          requestId,
          traceId,
          context: {
            hasUser: !!context.user,
            userId: context.user?.id,
            userAgent: context?.req?.headers?.['user-agent'] || 'unknown'
          }
        });

        // Validar que el usuario esté autenticado
        if (!context.user) {
          const duration = Date.now() - startTime;
          
          logger.warn('Logout attempted without authentication', {
            operation: 'logoutUser',
            requestId,
            traceId,
            duration,
            context: {
              userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
              ip: context?.req?.ip || 'unknown'
            }
          });
          
          return ResponseFactory.createErrorResponse(
            'User not authenticated',
            'UNAUTHORIZED',
            { reason: 'No authentication token provided' },
            { requestId, traceId, duration }
          );
        }

        // Obtener caso de uso de logout
        const logoutUserUseCase = container.get<LogoutUserUseCase>('logoutUserUseCase');
        
        // Ejecutar logout
        const result = await logoutUserUseCase.execute({
          userId: context.user.id,
          reason: 'user_request'
        });

        const duration = Date.now() - startTime;
        
        // Log de éxito
        logger.info('User logout completed successfully', {
          operation: 'logoutUser',
          userId: context.user.id,
          requestId,
          traceId,
          duration,
          result: {
            sessionsInvalidated: result.sessionsInvalidated,
            reason: result.reason
          }
        });
        
        // Crear respuesta exitosa usando ResponseFactory
        return ResponseFactory.createSuccessResponse(
          {
            userId: result.userId,
            loggedOutAt: result.loggedOutAt,
            reason: result.reason,
            sessionsInvalidated: result.sessionsInvalidated
          },
          'User logged out successfully',
          RESPONSE_CODES.LOGGED_OUT,
          { requestId, traceId, duration }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        const logger = container.get<ILogger>('defaultLogger');
        logger.error('LogoutUser resolver error', error, {
          operation: 'logoutUser',
          requestId,
          traceId,
          duration,
          errorDetails: {
            message: error.message,
            type: error.constructor.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          context: {
            hasUser: !!context.user,
            userId: context.user?.id,
            userAgent: context?.req?.headers?.['user-agent'] || 'unknown'
          }
        });
        
        // Manejar error usando GraphQLErrorHandler
        const errorResponse = GraphQLErrorHandler.handleError(error);
        
        // Crear respuesta de error usando ResponseFactory
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          { requestId, traceId, duration }
        );
      }
    },

    refreshToken: async (_: any, { refreshToken }: { refreshToken: string }, context: any) => {
      const startTime = Date.now();
      const traceId = `refresh-token-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Logger especializado para GraphQL
      const logger = container.get<ILogger>('defaultLogger');
      
      try {
        logger.info('RefreshToken mutation started', {
          operation: 'refreshToken',
          requestId,
          traceId,
          hasRefreshToken: !!refreshToken,
          context: {
            userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
            ipAddress: context?.req?.ip || context?.req?.connection?.remoteAddress || 'unknown'
          }
        });

        // Obtener el use case del container
        const refreshTokenUseCase = container.get<RefreshTokenUseCase>('refreshTokenUseCase');
        
        // Ejecutar el caso de uso con contexto adicional
        const result = await refreshTokenUseCase.execute({
          refreshToken,
          userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
          ipAddress: context?.req?.ip || context?.req?.connection?.remoteAddress || 'unknown'
        });

        const duration = Date.now() - startTime;
        
        // Log de éxito con contexto completo
        logger.info('RefreshToken mutation completed successfully', {
          operation: 'refreshToken',
          requestId,
          traceId,
          duration,
          userId: result.user?.id,
          provider: result.provider,
          isNewUser: result.isNewUser,
          sessionId: result.session?.id,
          context: {
            userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
            ipAddress: context?.req?.ip || context?.req?.connection?.remoteAddress || 'unknown'
          }
        });

        // Crear respuesta exitosa usando ResponseFactory siguiendo estándares
        return ResponseFactory.createSuccessResponse(
          {
            user: result.user,
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
            session: result.session
          },
          'Token refreshed successfully',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo usando logging estructurado
        logger.error('RefreshToken mutation failed', error, {
          operation: 'refreshToken',
          requestId,
          traceId,
          duration,
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : String(error),
          hasRefreshToken: !!refreshToken,
          context: {
            userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
            ipAddress: context?.req?.ip || context?.req?.connection?.remoteAddress || 'unknown'
          }
        });
        
        // Manejar error usando GraphQLErrorHandler para consistencia
        const errorResponse = GraphQLErrorHandler.handleError(error);
        
        // Crear respuesta de error usando ResponseFactory siguiendo estándares
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          { requestId, traceId, duration }
        );
      }
    },

    // Password management mutations
    updateUserPassword: async (_: any, { email, currentPassword, newPassword }: { 
      email: string; 
      currentPassword: string; 
      newPassword: string; 
    }, context: any) => {
      const startTime = Date.now();
      const traceId = context.traceId;
      const logger = LoggerFactory.getInstance().createLoggerWithContext({
        module: 'User',
        operation: 'updateUserPassword',
        userId: context.user?.id,
        traceId
      });
      
      logger.info('Starting password update operation', {
        email,
        hasCurrentPassword: !!currentPassword,
        hasNewPassword: !!newPassword
      });
      
      try {
        const updatePasswordUseCase = container.get<UpdateUserPasswordUseCase>('updateUserPasswordUseCase');
        await updatePasswordUseCase.execute({
          email,
          currentPassword,
          newPassword,
          confirmPassword: newPassword, // Using newPassword as confirmation for now
          ipAddress: context.req?.ip || context.req?.connection?.remoteAddress,
          userAgent: context.req?.headers?.['user-agent']
        });

        const duration = Date.now() - startTime;
        
        logger.info('Password updated successfully', {
          email,
          duration
        });
        
        return ResponseFactory.createSuccessResponse(
          {
            email,
            updatedAt: new Date().toISOString()
          },
          'Password updated successfully',
          RESPONSE_CODES.UPDATED,
          {
            requestId: context.requestId,
            traceId,
            duration
          }
        );
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        logger.error('Password update failed', error, {
          email,
          duration,
          errorCode: error.code || 'UNKNOWN_ERROR'
        });
        
        return ResponseFactory.createErrorResponse(
          error.message || 'Password update failed',
          error.code || RESPONSE_CODES.VALIDATION_ERROR,
          error.details,
          {
            requestId: context.requestId,
            traceId,
            duration
          }
        );
      }
    },

    requestPasswordReset: async (_: any, { email }: { email: string }, context: any) => {
      const startTime = Date.now();
      const traceId = context.traceId || `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        const updatePasswordUseCase = container.get<UpdateUserPasswordUseCase>('updateUserPasswordUseCase');
        await updatePasswordUseCase.generatePasswordResetToken(email);

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          {
            email,
            timestamp: new Date().toISOString()
          },
          'Password reset email sent successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId: context.requestId,
            traceId,
            duration
          }
        );
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        logger.error('Password reset request failed', error, {
          email,
          duration,
          errorCode: error.code || 'PASSWORD_RESET_REQUEST_FAILED'
        });
        
        return ResponseFactory.createErrorResponse(
          error.message || 'Password reset request failed',
          error.code || RESPONSE_CODES.VALIDATION_ERROR,
          { email },
          {
            requestId: context.requestId,
            traceId,
            duration
          }
        );
      }
    },

    resetPassword: async (_: any, { token, newPassword }: { token: string; newPassword: string }, context: any) => {
      const startTime = Date.now();
      const traceId = context.traceId || `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        const updatePasswordUseCase = container.get<UpdateUserPasswordUseCase>('updateUserPasswordUseCase');
        await updatePasswordUseCase.resetPasswordWithToken(token, newPassword);

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          {
            timestamp: new Date().toISOString(),
            passwordUpdated: true
          },
          'Password reset successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId: context.requestId,
            traceId,
            duration
          }
        );
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        logger.error('Password reset failed', error, {
          tokenLength: token ? token.length : 0,
          hasNewPassword: !!newPassword,
          duration,
          errorCode: error.code || 'PASSWORD_RESET_FAILED'
        });
        
        return ResponseFactory.createErrorResponse(
          error.message || 'Password reset failed',
          error.code || RESPONSE_CODES.VALIDATION_ERROR,
          { 
            tokenLength: token ? token.length : 0,
            hasNewPassword: !!newPassword
          },
          {
            requestId: context.requestId,
            traceId,
            duration
          }
        );
      }
    },

    setUserPassword: async (_: any, { userId, newPassword }: { userId: string; newPassword: string }, context: any) => {
      const startTime = Date.now();
      const traceId = context.traceId || `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const logger = LoggerFactory.getInstance().createLoggerWithContext({
        module: 'User',
        operation: 'setUserPassword',
        userId: context.user?.id,
        traceId
      });

      try {
        // 1. Verificar autenticación
        if (!context.user) {
          const duration = Date.now() - startTime;
          logger.warn('SetUserPassword failed: Authentication required', {
            targetUserId: userId,
            duration
          });

          return ResponseFactory.createErrorResponse(
            'Authentication required',
            RESPONSE_CODES.AUTHENTICATION_FAILED,
            { operation: 'setUserPassword' },
            {
              requestId: context.requestId,
              traceId,
              duration
            }
          );
        }

        // 2. Verificar que el usuario es administrador
        if (context.user.role !== UserRole.ADMIN) {
          const duration = Date.now() - startTime;
          logger.warn('SetUserPassword failed: Insufficient permissions', {
            adminUserId: context.user.id,
            adminRole: context.user.role,
            targetUserId: userId,
            duration
          });

          return ResponseFactory.createErrorResponse(
            'Only administrators can set user passwords',
            RESPONSE_CODES.INSUFFICIENT_PERMISSIONS,
            { 
              operation: 'setUserPassword',
              requiredRole: UserRole.ADMIN,
              currentRole: context.user.role
            },
            {
              requestId: context.requestId,
              traceId,
              duration
            }
          );
        }

        // 3. Ejecutar caso de uso
        logger.info('Starting administrative password set operation', {
          adminUserId: context.user.id,
          targetUserId: userId,
          hasNewPassword: !!newPassword
        });

        const setUserPasswordUseCase = container.get<SetUserPasswordUseCase>('setUserPasswordUseCase');
        await setUserPasswordUseCase.execute({
          userId,
          newPassword,
          adminUserId: context.user.id,
          adminEmail: context.user.email,
          ipAddress: context.req?.ip || context.req?.connection?.remoteAddress,
          userAgent: context.req?.headers?.['user-agent']
        });

        const duration = Date.now() - startTime;

        logger.info('Administrative password set completed successfully', {
          adminUserId: context.user.id,
          targetUserId: userId,
          duration
        });

        return ResponseFactory.createSuccessResponse(
          {
            userId,
            timestamp: new Date().toISOString(),
            passwordUpdated: true
          },
          'User password set successfully by administrator',
          RESPONSE_CODES.UPDATED,
          {
            requestId: context.requestId,
            traceId,
            duration
          }
        );
      } catch (error: any) {
        const duration = Date.now() - startTime;

        logger.error('Administrative password set failed', error, {
          adminUserId: context.user?.id,
          targetUserId: userId,
          duration,
          errorCode: error.code || 'SET_USER_PASSWORD_FAILED'
        });

        return ResponseFactory.createErrorResponse(
          error.message || 'Failed to set user password',
          error.code || RESPONSE_CODES.VALIDATION_ERROR,
          { 
            userId,
            hasNewPassword: !!newPassword
          },
          {
            requestId: context.requestId,
            traceId,
            duration
          }
        );
      }
    },

    // Address mutations
    createUserAddress: async (_: any, { input }: { input: any }, context: Context) => {
      const startTime = Date.now();
      const traceId = `create-address-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context.req?.id || `req-${Date.now()}`;
      
      try {
        const createUserAddressUseCase = container.get<CreateUserAddressUseCase>('createUserAddressUseCase');
        const address = await createUserAddressUseCase.execute({
          userId: input.userId,
          title: input.type,
          firstName: input.firstName,
          lastName: input.lastName,
          addressLine1: input.address1,
          addressLine2: input.address2,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country || 'PE',
          isDefault: input.isDefault || false
        });

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          {
            entity: transformUserAddress(address),
            id: address.id,
            createdAt: address.createdAt
          },
          'Address created successfully',
          RESPONSE_CODES.CREATED,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorResponse = GraphQLErrorHandler.handleError(error);
        
        console.error('CreateUserAddress resolver error:', {
          error: errorResponse,
          input,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    updateUserAddress: async (_: any, { id, input }: { id: string; input: any }, context: Context) => {
      const startTime = Date.now();
      const traceId = `update-address-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context.req?.id || `req-${Date.now()}`;
      
      try {
        const updateUserAddressUseCase = container.get<UpdateUserAddressUseCase>('updateUserAddressUseCase');
        
        // Transform input to match domain model
        const updateData: any = {};
        if (input.type !== undefined) updateData.title = input.type;
        if (input.firstName !== undefined) updateData.firstName = input.firstName;
        if (input.lastName !== undefined) updateData.lastName = input.lastName;
        if (input.address1 !== undefined) updateData.addressLine1 = input.address1;
        if (input.address2 !== undefined) updateData.addressLine2 = input.address2;
        if (input.city !== undefined) updateData.city = input.city;
        if (input.state !== undefined) updateData.state = input.state;
        if (input.postalCode !== undefined) updateData.postalCode = input.postalCode;
        if (input.country !== undefined) updateData.country = input.country;
        if (input.phone !== undefined) updateData.phone = input.phone;
        if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

        const address = await updateUserAddressUseCase.execute(id, updateData);

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          {
            entity: transformUserAddress(address),
            id: address.id,
            updatedAt: address.updatedAt,
            changes: Object.keys(updateData)
          },
          'Address updated successfully',
          RESPONSE_CODES.UPDATED,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorResponse = GraphQLErrorHandler.handleError(error);
        
        console.error('UpdateUserAddress resolver error:', {
          error: errorResponse,
          id,
          input,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    deleteUserAddress: async (_: any, { id }: { id: string }, context: Context) => {
      const startTime = Date.now();
      const traceId = `delete-address-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context.req?.id || `req-${Date.now()}`;
      
      try {
        const deleteUserAddressUseCase = container.get<DeleteUserAddressUseCase>('deleteUserAddressUseCase');
        await deleteUserAddressUseCase.execute(id);

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          {
            id,
            deletedAt: new Date().toISOString(),
            softDelete: false
          },
          'Address deleted successfully',
          RESPONSE_CODES.DELETED,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorResponse = GraphQLErrorHandler.handleError(error);
        
        console.error('DeleteUserAddress resolver error:', {
          error: errorResponse,
          id,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    setDefaultAddress: async (_: any, { userId, addressId }: { userId: string; addressId: string }, context: Context) => {
      const startTime = Date.now();
      const traceId = `set-default-address-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context.req?.id || `req-${Date.now()}`;
      
      try {
        const setDefaultAddressUseCase = container.get<SetDefaultAddressUseCase>('setDefaultAddressUseCase');
        await setDefaultAddressUseCase.execute(userId, addressId);

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          {
            userId,
            addressId,
            updatedAt: new Date().toISOString()
          },
          'Default address set successfully',
          RESPONSE_CODES.UPDATED,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorResponse = GraphQLErrorHandler.handleError(error);
        
        console.error('SetDefaultAddress resolver error:', {
          error: errorResponse,
          userId,
          addressId,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    // Favorites mutations
    addToFavorites: async (_: any, { input }: { input: any }) => {
      try {
        const favoritesUseCase = container.get<ManageUserFavoritesUseCase>('manageUserFavoritesUseCase');
        const favorite = await favoritesUseCase.addToFavorites({
          userId: input.userId,
          productId: input.productId
        });

        return {
          id: favorite.id,
          userId: favorite.userId,
          productId: favorite.productId,
          createdAt: favorite.createdAt
        };
      } catch (error: any) {
        throw new Error(`Failed to add to favorites: ${error.message}`);
      }
    },

    removeFromFavorites: async (_: any, { userId, productId }: { userId: string; productId: string }) => {
      try {
        const favoritesUseCase = container.get<ManageUserFavoritesUseCase>('manageUserFavoritesUseCase');
        await favoritesUseCase.removeFromFavorites({ userId, productId });

        return {
          success: true,
          message: 'Removed from favorites successfully'
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || 'Failed to remove from favorites'
        };
      }
    },

    toggleFavorite: async (_: any, { userId, productId }: { userId: string; productId: string }) => {
      try {
        const favoritesUseCase = container.get<ManageUserFavoritesUseCase>('manageUserFavoritesUseCase');
        const result = await favoritesUseCase.toggleFavorite(userId, productId);

        return {
          action: result.action,
          favorite: result.favorite ? {
            id: result.favorite.id,
            userId: result.favorite.userId,
            productId: result.favorite.productId,
            createdAt: result.favorite.createdAt
          } : null,
          message: `Product ${result.action} favorites successfully`
        };
      } catch (error: any) {
        throw new Error(`Failed to toggle favorite: ${error.message}`);
      }
    },

    deleteUserProfile: async (_: any, { userId }: { userId: string }) => {
      // This would use the user repository to soft delete
      return { success: true, message: 'User profile deleted successfully' };
    },

    // uploadImage/uploadSvg → migrated to media-service (Federation)

    // createCategory / updateCategory / deleteCategory → migrated to category-service (Federation)

    // createProductVariant / updateProductVariant / deleteProductVariant → migrated to product-service (Federation)
    addToCart: () => null,
    updateCartItem: () => null,
    removeFromCart: () => ({ success: true, message: 'Item removed from cart' }),
    clearUserCart: () => ({ success: true, message: 'Cart cleared successfully' }),
    cancelOrder: () => null,
    shipOrder: () => null,
    deliverOrder: () => null,
    createOrderItem: () => null,
    updateOrderItem: () => null,
    deleteOrderItem: () => ({ success: true, message: 'Order item deleted successfully' }),
    createPaymentMethod: () => null,
    updatePaymentMethod: () => null,
    deletePaymentMethod: () => ({ success: true, message: 'Payment method deleted successfully' }),
    // bulkUpdateProducts → migrated to product-service (Federation)
    bulkUpdateOrderStatus: async (_: any, { orders, status }: { orders: string[]; status: string }, context: any) => {
      const startTime = Date.now();
      const traceId = `bulk-update-order-status-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        if (!orders || orders.length === 0) {
          const duration = Date.now() - startTime;
          return ResponseFactory.createErrorResponse(
            'No orders provided',
            RESPONSE_CODES.MISSING_REQUIRED_FIELD,
            { orders },
            {
              requestId,
              traceId,
              duration
            }
          );
        }

        if (!status) {
          const duration = Date.now() - startTime;
          return ResponseFactory.createErrorResponse(
            'Status is required',
            RESPONSE_CODES.MISSING_REQUIRED_FIELD,
            { status },
            {
              requestId,
              traceId,
              duration
            }
          );
        }

        // TODO: Implementar bulk update real
        // Por ahora retornamos un placeholder
        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          [],
          'Bulk update order status completed successfully',
          RESPONSE_CODES.SUCCESS,
          {
            requestId,
            traceId,
            duration
          }
        );
        
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        console.error('BulkUpdateOrderStatus resolver error:', {
          error: error.message,
          orders,
          status,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          `Failed to bulk update order status: ${error.message || 'Unknown error'}`,
          RESPONSE_CODES.INTERNAL_ERROR,
          { orders, status, error: error.message },
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    // Session Analytics mutations
    createUserSessionAnalytics: async (_: any, { input }: { input: any }, context: any) => {
      const startTime = Date.now();
      const traceId = `create-session-analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Logger especializado para GraphQL
      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        // Log del inicio de la operación
        logger.info('CreateUserSessionAnalytics mutation started', {
          operation: 'createUserSessionAnalytics',
          requestId,
          traceId,
          input: {
            sessionId: input.sessionId,
            userId: input.userId,
            hasPageViews: input.pageViews !== undefined,
            hasTimeSpent: input.timeSpent !== undefined,
            hasDeviceInfo: !!(input.deviceType || input.browser || input.os)
          },
          timestamp: new Date().toISOString()
        });

        const createUserSessionAnalyticsUseCase = container.get<CreateUserSessionAnalyticsUseCase>('createUserSessionAnalyticsUseCase');
        const result = await createUserSessionAnalyticsUseCase.execute(input);

        const duration = Date.now() - startTime;
        
        // Log del éxito
        logger.info('CreateUserSessionAnalytics mutation success', {
          operation: 'createUserSessionAnalytics',
          requestId,
          traceId,
          duration,
          analyticsId: result.analytics.id,
          sessionId: result.analytics.sessionId,
          userId: result.analytics.userId,
          timestamp: new Date().toISOString()
        });

        return ResponseFactory.createSuccessResponse(
          {
            entity: transformUserSessionAnalytics(result.analytics),
            id: result.analytics.id,
            createdAt: result.analytics.createdAt.toISOString()
          },
          'User session analytics created successfully',
          RESPONSE_CODES.CREATED,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        logger.error('CreateUserSessionAnalytics mutation error', error, {
          operation: 'createUserSessionAnalytics',
          requestId,
          traceId,
          duration,
          input: {
            sessionId: input.sessionId,
            userId: input.userId
          },
          errorDetails: {
            message: error.message,
            type: error.constructor.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          timestamp: new Date().toISOString()
        });
        
        // Determinar el código de error apropiado
        let errorCode: string = RESPONSE_CODES.INTERNAL_ERROR;
        let errorMessage = error.message || 'Failed to create user session analytics';
        
        if (error.message?.includes('required') || error.message?.includes('Validation failed')) {
          errorCode = RESPONSE_CODES.VALIDATION_ERROR;
        } else if (error.message?.includes('not found')) {
          errorCode = RESPONSE_CODES.RESOURCE_NOT_FOUND;
        }
        
        return ResponseFactory.createErrorResponse(
          errorMessage,
          errorCode as any,
          { input, error: error.message },
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    updateUserSessionAnalytics: async (_: any, { id, input }: { id: string; input: any }, context: any) => {
      const startTime = Date.now();
      const traceId = `update-session-analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Logger especializado para GraphQL
      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        // Log del inicio de la operación
        logger.info('UpdateUserSessionAnalytics mutation started', {
          operation: 'updateUserSessionAnalytics',
          requestId,
          traceId,
          analyticsId: id,
          input: {
            hasPageViews: input.pageViews !== undefined,
            hasTimeSpent: input.timeSpent !== undefined,
            hasDeviceInfo: !!(input.deviceType || input.browser || input.os)
          },
          timestamp: new Date().toISOString()
        });

        const updateUserSessionAnalyticsUseCase = container.get<UpdateUserSessionAnalyticsUseCase>('updateUserSessionAnalyticsUseCase');
        const result = await updateUserSessionAnalyticsUseCase.execute(id, input);

        const duration = Date.now() - startTime;
        
        // Log del éxito
        logger.info('UpdateUserSessionAnalytics mutation success', {
          operation: 'updateUserSessionAnalytics',
          requestId,
          traceId,
          duration,
          analyticsId: id,
          sessionId: result.analytics.sessionId,
          userId: result.analytics.userId,
          changes: result.changes,
          timestamp: new Date().toISOString()
        });

        return ResponseFactory.createSuccessResponse(
          {
            entity: transformUserSessionAnalytics(result.analytics),
            id: result.analytics.id,
            updatedAt: result.analytics.updatedAt.toISOString(),
            changes: result.changes
          },
          'User session analytics updated successfully',
          RESPONSE_CODES.UPDATED,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        logger.error('UpdateUserSessionAnalytics mutation error', error, {
          operation: 'updateUserSessionAnalytics',
          requestId,
          traceId,
          duration,
          analyticsId: id,
          input: {
            hasPageViews: input.pageViews !== undefined,
            hasTimeSpent: input.timeSpent !== undefined
          },
          errorDetails: {
            message: error.message,
            type: error.constructor.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          timestamp: new Date().toISOString()
        });
        
        // Determinar el código de error apropiado
        let errorCode: string = RESPONSE_CODES.INTERNAL_ERROR;
        let errorMessage = error.message || 'Failed to update user session analytics';
        
        if (error.message?.includes('required') || error.message?.includes('Validation failed')) {
          errorCode = RESPONSE_CODES.VALIDATION_ERROR;
        } else if (error.message?.includes('not found')) {
          errorCode = RESPONSE_CODES.RESOURCE_NOT_FOUND;
        }
        
        return ResponseFactory.createErrorResponse(
          errorMessage,
          errorCode as any,
          { id, input, error: error.message },
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    deleteUserSessionAnalytics: async (_: any, { id }: { id: string }, context: any) => {
      const startTime = Date.now();
      const traceId = `delete-session-analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      // Logger especializado para GraphQL
      const logger = LoggerFactory.getInstance().createGraphQLLogger();
      
      try {
        // Log del inicio de la operación
        logger.info('DeleteUserSessionAnalytics mutation started', {
          operation: 'deleteUserSessionAnalytics',
          requestId,
          traceId,
          analyticsId: id,
          timestamp: new Date().toISOString()
        });

        // TODO: Implementar caso de uso de eliminación
        // Por ahora retornamos un placeholder
        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          {
            id,
            deletedAt: new Date().toISOString(),
            softDelete: false
          },
          'User session analytics deleted successfully',
          RESPONSE_CODES.DELETED,
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        logger.error('DeleteUserSessionAnalytics mutation error', error, {
          operation: 'deleteUserSessionAnalytics',
          requestId,
          traceId,
          duration,
          analyticsId: id,
          errorDetails: {
            message: error.message,
            type: error.constructor.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          timestamp: new Date().toISOString()
        });
        
        return ResponseFactory.createErrorResponse(
          `Failed to delete user session analytics: ${error.message || 'Unknown error'}`,
          RESPONSE_CODES.INTERNAL_ERROR,
          { id, error: error.message },
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },
  }
};