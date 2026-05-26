import { GraphQLScalarType, Kind } from 'graphql';
import { Container } from '@shared/container';
import { GraphQLErrorHandler, handleResolverError } from './error-handler';
import { ResponseFactory } from '@hbs/shared-kernel';
import { Context } from './server';
import { RESPONSE_CODES } from '@hbs/shared-kernel';
import { LoggerFactory } from '@hbs/logging';
import { ILogger } from '@hbs/logging';
import { GetProductsUseCase } from '@application/use-cases/product/GetProductsUseCase';
import { GetOrderStatsUseCase } from '@application/use-cases/order/GetOrderStatsUseCase';
import { GetUserStatsUseCase } from '@application/use-cases/user/GetUserStatsUseCase';
import { ManageUserFavoritesUseCase } from '@application/use-cases/user/ManageUserFavoritesUseCase';
import { storageConfig } from '@config/storage';
import { UrlBuilder } from '@shared/utils/UrlBuilder';

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

        const orderStats = await getOrderStatsUseCase.execute();

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
            revenueByMonth: {},
            topCustomers: []
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

        const userStats = await getUserStatsUseCase.execute();

        const duration = Date.now() - startTime;

        return ResponseFactory.createSuccessResponse(
          {
            totalUsers: userStats.totalUsers || 0,
            activeUsers: userStats.activeUsers || 0,
            newUsersThisMonth: userStats.newUsersThisMonth || 0,
            usersByRole: {},
            topSpenders: [],
            userEngagement: {}
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
    // orders / order / orderByNumber / userOrders / orderItems → migrated to order-service (Federation)

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
    // createOrder / updateOrder / updateOrderStatus / cancelOrder / shipOrder / deliverOrder / bulkUpdateOrderStatus → migrated to order-service (Federation)

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
    // cancelOrder / shipOrder / deliverOrder / createOrderItem / updateOrderItem / deleteOrderItem / bulkUpdateOrderStatus → migrated to order-service (Federation)
    addToCart: () => null,
    updateCartItem: () => null,
    removeFromCart: () => ({ success: true, message: 'Item removed from cart' }),
    clearUserCart: () => ({ success: true, message: 'Cart cleared successfully' }),
    createPaymentMethod: () => null,
    updatePaymentMethod: () => null,
    deletePaymentMethod: () => ({ success: true, message: 'Payment method deleted successfully' }),

  }
};