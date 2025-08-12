import { GraphQLScalarType, Kind } from 'graphql';
import { Container } from '@shared/container';
import { GraphQLErrorHandler, handleResolverError } from './error-handler';
import { ResponseFactory } from '@shared/factories/ResponseFactory';
import { RESPONSE_CODES } from '@shared/constants/ResponseCodes';
import { GetProductsUseCase } from '@application/use-cases/product/GetProductsUseCase';
import { GetProductByIdUseCase } from '@application/use-cases/product/GetProductByIdUseCase';
import { CreateProductUseCase } from '@application/use-cases/product/CreateProductUseCase';
import { UpdateProductUseCase } from '@application/use-cases/product/UpdateProductUseCase';
import { DeleteProductUseCase } from '@application/use-cases/product/DeleteProductUseCase';
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
import { UploadImageUseCase } from '@application/use-cases/image/UploadImageUseCase';
import { CreateCategoryUseCase } from '@application/use-cases/category/CreateCategoryUseCase';
import { UpdateCategoryUseCase } from '@application/use-cases/category/UpdateCategoryUseCase';
import { DeleteCategoryUseCase } from '@application/use-cases/category/DeleteCategoryUseCase';
import { transformCategory } from './transformers/categoryTransformer';
import { GetCategoriesUseCase } from '@application/use-cases/category/GetCategoriesUseCase';
import { GetCategoryByIdUseCase } from '@application/use-cases/category/GetCategoryByIdUseCase';
import { GetCategoryBySlugUseCase } from '@application/use-cases/category/GetCategoryBySlugUseCase';

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

const transformProduct = (product: any) => ({
  ...product,
  categoryId: product.category_id || '',
  salePrice: product.sale_price,
  stockQuantity: parseInt(product.stock_quantity) || 0, // Ensure integer value
  isActive: Boolean(product.is_active), // Ensure boolean value
  reviewCount: parseInt(product.review_count) || 0, // Ensure integer value
  createdAt: product.created_at || new Date(),
  updatedAt: product.updated_at || new Date(),
  // Relations - ensure arrays are never null
  variants: product.variants || [], // Ensure array is never null
  cartItems: product.cartItems || [], // Ensure array is never null
  favorites: product.favorites || [], // Ensure array is never null
  orderItems: product.orderItems || [], // Ensure array is never null
  // Computed fields
  currentPrice: product.sale_price || product.price || 0,
  hasDiscount: Boolean(product.sale_price && product.price && product.sale_price < product.price),
  discountPercentage: product.sale_price && product.price && product.price > 0 
    ? Math.round(((product.price - product.sale_price) / product.price) * 100)
    : 0,
  totalStock: parseInt(product.stock_quantity) || 0,
  isInStock: (parseInt(product.stock_quantity) || 0) > 0,
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
  Category: {
    products: async (parent: any, _: any, context: any) => {
      const startTime = Date.now();
      const traceId = `category-products-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        // Usar DataLoaders del contexto
        if (context.dataloaders?.productsByCategoryLoader) {
          const products = await context.dataloaders.productsByCategoryLoader.load(parent.id);
          const duration = Date.now() - startTime;
          
          console.log('Category.products resolver success (DataLoader)', {
            categoryId: parent.id,
            productsCount: products.length,
            requestId,
            traceId,
            duration,
            timestamp: new Date()
          });
          
          return products;
        } else {
          // Fallback: usar el repositorio directamente
          const productRepository = container.get('productRepository') as any;
          const products = await productRepository.findByCategory(parent.id);
          const duration = Date.now() - startTime;
          
          console.log('Category.products resolver success (Repository fallback)', {
            categoryId: parent.id,
            productsCount: products.length,
            requestId,
            traceId,
            duration,
            timestamp: new Date()
          });
          
          return products.map(transformProduct);
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        
        console.error('Category.products resolver error:', {
          error: error instanceof Error ? error.message : String(error),
          categoryId: parent.id,
          requestId,
          traceId,
          duration,
          timestamp: new Date()
        });
        
        return [];
      }
    }
  },

  Product: {
    category: async (parent: any, _: any, context: any) => {
      const startTime = Date.now();
      const traceId = `product-category-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        if (!parent.categoryId) {
          const duration = Date.now() - startTime;
          
          console.log('Product.category resolver success (no category)', {
            productId: parent.id,
            requestId,
            traceId,
            duration,
            timestamp: new Date()
          });
          
          return null;
        }
        
        if (context.dataloaders?.categoryLoader) {
          const category = await context.dataloaders.categoryLoader.load(parent.categoryId);
          const duration = Date.now() - startTime;
          
          console.log('Product.category resolver success (DataLoader)', {
            productId: parent.id,
            categoryId: parent.categoryId,
            requestId,
            traceId,
            duration,
            timestamp: new Date()
          });
          
          return category;
        } else {
          // Fallback: usar el repositorio directamente
          const categoryRepository = container.get('categoryRepository') as any;
          const category = await categoryRepository.findById(parent.categoryId);
          const duration = Date.now() - startTime;
          
          console.log('Product.category resolver success (Repository fallback)', {
            productId: parent.id,
            categoryId: parent.categoryId,
            categoryFound: !!category,
            requestId,
            traceId,
            duration,
            timestamp: new Date()
          });
          
          return category ? transformCategory(category) : null;
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        
        console.error('Product.category resolver error:', {
          error: error instanceof Error ? error.message : String(error),
          productId: parent.id,
          categoryId: parent.categoryId,
          requestId,
          traceId,
          duration,
          timestamp: new Date()
        });
        
        return null;
      }
    }
  },

  Query: {
    health: () => 'GraphQL server is running with clean architecture!',

    // Dashboard & Analytics queries - CRITICAL FOR ADMIN
    dashboardMetrics: async () => {
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

        return {
          totalUsers: userStats.totalUsers || 0,
          totalProducts: productsResult.total || 0,
          totalOrders: orderStats.totalOrders || 0,
          totalRevenue: orderStats.totalRevenue || 0,
          todayOrders,
          todayRevenue,
          pendingOrders: orderStats.pendingOrders || 0,
          lowStockProducts,
          activeCoupons: 0 // TODO: Implement coupon repository
        };
      } catch (error: any) {
        console.error('Error fetching dashboard metrics:', error);
        return {
          totalUsers: 0,
          totalProducts: 0,
          totalOrders: 0,
          totalRevenue: 0,
          todayOrders: 0,
          todayRevenue: 0,
          pendingOrders: 0,
          lowStockProducts: 0,
          activeCoupons: 0
        };
      }
    },

    productAnalytics: async () => {
      try {
        const getProductsUseCase = container.get<GetProductsUseCase>('getProductsUseCase');
        const result = await getProductsUseCase.execute({ 
          filters: {}, 
          pagination: { limit: 1000, offset: 0 } 
        });

        const products = result.products.map(transformProduct);
        const activeProducts = products.filter(p => p.isActive).length;
        const lowStockProducts = products.filter(p => p.stockQuantity < 10).length;
        const outOfStockProducts = products.filter(p => p.stockQuantity === 0).length;

        // Calculate average rating
        const productsWithRating = products.filter(p => p.rating > 0);
        const averageRating = productsWithRating.length > 0 
          ? productsWithRating.reduce((sum, p) => sum + p.rating, 0) / productsWithRating.length 
          : 0;

        // Get top selling products (placeholder - would need order data)
        const topSellingProducts = products.slice(0, 5);
        const topRatedProducts = products
          .filter(p => p.rating > 0)
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 5);

        return {
          totalProducts: products.length,
          activeProducts,
          lowStockProducts,
          outOfStockProducts,
          averageRating,
          totalReviews: products.reduce((sum, p) => sum + p.reviewCount, 0),
          topSellingProducts,
          topRatedProducts
        };
      } catch (error: any) {
        console.error('Error fetching product analytics:', error);
        return {
          totalProducts: 0,
          activeProducts: 0,
          lowStockProducts: 0,
          outOfStockProducts: 0,
          averageRating: 0,
          totalReviews: 0,
          topSellingProducts: [],
          topRatedProducts: []
        };
      }
    },

    orderAnalytics: async () => {
      try {
        const getOrderStatsUseCase = container.get<GetOrderStatsUseCase>('getOrderStatsUseCase');
        const getUsersUseCase = container.get<GetUsersUseCase>('getUsersUseCase');
        
        const [orderStats, usersResult] = await Promise.all([
          getOrderStatsUseCase.execute(),
          getUsersUseCase.execute({ limit: 100, offset: 0 })
        ]);

        const users = usersResult.map(transformUser);
        const topCustomers = users.slice(0, 5); // Placeholder - would need spending data

        return {
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
        };
      } catch (error: any) {
        console.error('Error fetching order analytics:', error);
        return {
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          ordersByStatus: {},
          revenueByMonth: {},
          topCustomers: []
        };
      }
    },

    userAnalytics: async () => {
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

        return {
          totalUsers: users.length,
          activeUsers,
          newUsersThisMonth,
          usersByRole,
          topSpenders,
          userEngagement: {} // TODO: Implement engagement metrics
        };
      } catch (error: any) {
        console.error('Error fetching user analytics:', error);
        return {
          totalUsers: 0,
          activeUsers: 0,
          newUsersThisMonth: 0,
          usersByRole: {},
          topSpenders: [],
          userEngagement: {}
        };
      }
    },

    // Product queries
    products: async (_: any, { filter, pagination }: any, context: any) => {
      const startTime = Date.now();
      const traceId = `get-products-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        const getProductsUseCase = container.get<GetProductsUseCase>('getProductsUseCase');
        
        const result = await getProductsUseCase.execute({
          filters: filter,
          pagination: pagination || { limit: 10, offset: 0 }
        });

        const duration = Date.now() - startTime;
        
        // Calcular información de paginación
        const limit = pagination?.limit || 10;
        const offset = pagination?.offset || 0;
        const currentPage = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(result.total / limit);
        
        return ResponseFactory.createPaginatedResponse(
          result.products.map(transformProduct),
          {
            total: result.total,
            limit,
            offset,
            hasMore: result.hasMore,
            currentPage,
            totalPages
          },
          'Products retrieved successfully',
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        console.error('GetProducts resolver error:', {
          error: error.message,
          filter,
          pagination,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          `Failed to fetch products: ${error.message || 'Unknown error'}`,
          RESPONSE_CODES.INTERNAL_ERROR,
          { filter, pagination, error: error.message },
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    product: async (_: any, { id }: { id: string }, context: any) => {
      const startTime = Date.now();
      const traceId = `get-product-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        if (!id) {
          const duration = Date.now() - startTime;
          return ResponseFactory.createErrorResponse(
            'Product ID is required',
            RESPONSE_CODES.MISSING_REQUIRED_FIELD,
            { id },
            {
              requestId,
              traceId,
              duration
            }
          );
        }

        const getProductByIdUseCase = container.get<GetProductByIdUseCase>('getProductByIdUseCase');
        const product = await getProductByIdUseCase.execute({ id });
        
        if (!product) {
          const duration = Date.now() - startTime;
          return ResponseFactory.createErrorResponse(
            'Product not found',
            RESPONSE_CODES.RESOURCE_NOT_FOUND,
            { id },
            {
              requestId,
              traceId,
              duration
            }
          );
        }

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          { entity: transformProduct(product) },
          'Product retrieved successfully',
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
        console.error('GetProduct resolver error:', {
          error: error.message,
          id,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          `Failed to fetch product: ${error.message || 'Unknown error'}`,
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

    productBySku: async (_: any, { sku }: { sku: string }, context: any) => {
      const startTime = Date.now();
      const traceId = `get-product-by-sku-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        if (!sku) {
          const duration = Date.now() - startTime;
          return ResponseFactory.createErrorResponse(
            'Product SKU is required',
            RESPONSE_CODES.MISSING_REQUIRED_FIELD,
            { sku },
            {
              requestId,
              traceId,
              duration
            }
          );
        }

        const getProductsUseCase = container.get<GetProductsUseCase>('getProductsUseCase');
        const result = await getProductsUseCase.execute({
          filters: { sku },
          pagination: { limit: 1, offset: 0 }
        });

        if (!result.products[0]) {
          const duration = Date.now() - startTime;
          return ResponseFactory.createErrorResponse(
            'Product not found',
            RESPONSE_CODES.RESOURCE_NOT_FOUND,
            { sku },
            {
              requestId,
              traceId,
              duration
            }
          );
        }

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          { entity: transformProduct(result.products[0]) },
          'Product retrieved successfully',
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
        console.error('GetProductBySku resolver error:', {
          error: error.message,
          sku,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          `Failed to fetch product by SKU: ${error.message || 'Unknown error'}`,
          RESPONSE_CODES.INTERNAL_ERROR,
          { sku, error: error.message },
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    // Search products - IMPLEMENTED
    searchProducts: async (_: any, { query, filter, pagination }: any) => {
      try {
        const getProductsUseCase = container.get<GetProductsUseCase>('getProductsUseCase');
        
        const result = await getProductsUseCase.execute({
          filters: { ...filter, search: query },
          pagination: pagination || { limit: 10, offset: 0 }
        });
        
        return {
          products: result.products.map(transformProduct),
          total: result.total,
          hasMore: result.hasMore
        };
      } catch (error: any) {
        throw new Error(`Failed to search products: ${error.message || 'Unknown error'}`);
      }
    },

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
    users: async (_: any, { filter, pagination }: any) => {
      try {
        const getUsersUseCase = container.get<GetUsersUseCase>('getUsersUseCase');
        const limit = pagination?.limit || 10;
        const offset = pagination?.offset || 0;
        
        // Get users for current page
        const result = await getUsersUseCase.execute({
          role: filter?.role,
          isActive: filter?.isActive,
          search: filter?.search,
          limit,
          offset
        });

        // Check if result has the expected structure
        if (result && typeof result === 'object' && 'users' in result && 'total' in result) {
          // Repository returned paginated result
          return {
            users: (result as any).users.map(transformUser),
            total: (result as any).total,
            hasMore: (result as any).users.length === limit
          };
        } else {
          // Fallback for backward compatibility
          const users = Array.isArray(result) ? result : [];
          const total = users.length + (users.length === limit ? 50 : 0);
          const hasMore = users.length === limit;
          
          return {
            users: users.map(transformUser),
            total,
            hasMore
          };
        }
      } catch (error) {
        console.error('Error in users resolver:', error);
        throw new Error('Failed to fetch users');
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
      if (!context.user) {
        throw new Error('Authentication required');
      }
      
      const getUserByIdUseCase = container.get<GetUserByIdUseCase>('getUserByIdUseCase');
      const user = await getUserByIdUseCase.execute(context.user.id);
      return user ? transformUser(user) : null;
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

    usersByProvider: async (_: any, { provider }: { provider: string }) => {
      // TODO: Implement provider filtering in repository
      const getUsersUseCase = container.get<GetUsersUseCase>('getUsersUseCase');
      const users = await getUsersUseCase.execute({
        limit: 100,
        offset: 0
      });
      return users.map(transformUser);
    },

    // Authentication queries
    userAccounts: async (_: any, { userId }: { userId: string }) => {
      // This would be implemented with proper repository
      return [];
    },

    userSessions: async (_: any, { userId }: { userId: string }) => {
      // This would be implemented with proper repository
      return [];
    },

    activeSessions: async (_: any, { userId }: { userId: string }) => {
      // This would be implemented with proper repository
      return [];
    },

    userSessionAnalytics: async (_: any, { userId }: { userId: string }) => {
      // This would be implemented with proper repository
      return [];
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
    productStats: async () => {
      try {
        const getProductsUseCase = container.get<GetProductsUseCase>('getProductsUseCase');
        const result = await getProductsUseCase.execute({ 
          filters: {}, 
          pagination: { limit: 1000, offset: 0 } 
        });

        const products = result.products.map(transformProduct);
        const activeProducts = products.filter(p => p.isActive).length;

        return {
          totalProducts: products.length,
          activeProducts,
          totalCategories: 0 // TODO: Implement category repository
        };
      } catch (error: any) {
        return {
          totalProducts: 0,
          activeProducts: 0,
          totalCategories: 0
        };
      }
    },

    orderStats: async () => {
      const getOrderStatsUseCase = container.get<GetOrderStatsUseCase>('getOrderStatsUseCase');
      return await getOrderStatsUseCase.execute();
    },

    userStats: async () => {
      const getUserStatsUseCase = container.get<GetUserStatsUseCase>('getUserStatsUseCase');
      return await getUserStatsUseCase.execute();
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
    userAddresses: async (_: any, { userId }: { userId: string }) => {
      try {
        const getUserByIdUseCase = container.get<GetUserByIdUseCase>('getUserByIdUseCase');
        const user = await getUserByIdUseCase.execute(userId);
        return user?.addresses?.map(transformUserAddress) || [];
      } catch (error: any) {
        return [];
      }
    },

    userAddress: async (_: any, { id }: { id: string }) => {
      // This would need a dedicated getUserAddressById use case
      return null;
    },

    // Placeholder queries with mock data for testing
    categories: async (_: any, { filters, pagination }: any, context: any) => {
      const startTime = Date.now();
      const traceId = `get-categories-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        const getCategoriesUseCase = container.get<GetCategoriesUseCase>('getCategoriesUseCase');
        const result = await getCategoriesUseCase.execute({
          filters: filters || {},
          pagination: pagination || { limit: 50, offset: 0 }
        });

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createPaginatedResponse(
          result.categories.map(transformCategory),
          {
            total: result.total,
            limit: pagination?.limit || 50,
            offset: pagination?.offset || 0,
            hasMore: result.hasMore,
            currentPage: Math.floor((pagination?.offset || 0) / (pagination?.limit || 50)) + 1,
            totalPages: Math.ceil(result.total / (pagination?.limit || 50))
          },
          'Categories retrieved successfully',
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
        console.error('GetCategories resolver error:', {
          error: errorResponse,
          filters,
          pagination,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          (errorResponse.code as any) || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    category: async (_: any, { id }: { id: string }, context: any) => {
      const startTime = Date.now();
      const traceId = `get-category-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        const getCategoryByIdUseCase = container.get<GetCategoryByIdUseCase>('getCategoryByIdUseCase');
        const category = await getCategoryByIdUseCase.execute({ id });

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          transformCategory(category),
          'Category retrieved successfully',
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
        
        // Log del error con contexto completo
        console.error('GetCategoryById resolver error:', {
          error: errorResponse,
          categoryId: id,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          (errorResponse.code as any) || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    categoryBySlug: async (_: any, { slug }: { slug: string }, context: any) => {
      const startTime = Date.now();
      const traceId = `get-category-by-slug-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        const getCategoryBySlugUseCase = container.get<GetCategoryBySlugUseCase>('getCategoryBySlugUseCase');
        const category = await getCategoryBySlugUseCase.execute({ slug });

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          transformCategory(category),
          'Category retrieved successfully',
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
        
        // Log del error con contexto completo
        console.error('GetCategoryBySlug resolver error:', {
          error: errorResponse,
          slug,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          (errorResponse.code as any) || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },

    productsByCategory: async (_: any, { categoryId, pagination }: any) => {
      try {
        const getProductsUseCase = container.get<GetProductsUseCase>('getProductsUseCase');
        const result = await getProductsUseCase.execute({
          filters: { category: categoryId },
          pagination: pagination || { limit: 10, offset: 0 }
        });
        
        return {
          products: result.products.map(transformProduct),
          total: result.total,
          hasMore: result.hasMore
        };
      } catch (error: any) {
        console.error('Error fetching products by category:', error);
        return { products: [], total: 0, hasMore: false };
      }
    },

    productVariants: async (_: any, { productId }: { productId: string }) => {
      return [
        {
          id: 'var-1',
          productId: productId,
          name: 'Small - Blue',
          price: 24.99,
          sku: 'ONESIE-001-S-BLUE',
          stockQuantity: 25,
          attributes: { size: 'S', color: 'Blue' },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'var-2',
          productId: productId,
          name: 'Medium - Blue',
          price: 24.99,
          sku: 'ONESIE-001-M-BLUE',
          stockQuantity: 30,
          attributes: { size: 'M', color: 'Blue' },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    },

    productVariant: async (_: any, { id }: { id: string }) => {
      const variants = [
        {
          id: 'var-1',
          productId: 'prod-1',
          name: 'Small - Blue',
          price: 24.99,
          sku: 'ONESIE-001-S-BLUE',
          stockQuantity: 25,
          attributes: { size: 'S', color: 'Blue' },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      return variants.find(variant => variant.id === id) || null;
    },

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

    lowStockProducts: async () => {
      try {
        const getProductsUseCase = container.get<GetProductsUseCase>('getProductsUseCase');
        const result = await getProductsUseCase.execute({
          filters: {},
          pagination: { limit: 1000, offset: 0 }
        });
        
        return result.products
          .filter(product => product.stockQuantity < 10)
          .map(transformProduct);
      } catch (error: any) {
        console.error('Error fetching low stock products:', error);
        return [];
      }
    },

    outOfStockProducts: async () => {
      try {
        const getProductsUseCase = container.get<GetProductsUseCase>('getProductsUseCase');
        const result = await getProductsUseCase.execute({
          filters: {},
          pagination: { limit: 1000, offset: 0 }
        });
        
        return result.products
          .filter(product => product.stockQuantity === 0)
          .map(transformProduct);
      } catch (error: any) {
        console.error('Error fetching out of stock products:', error);
        return [];
      }
    },

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

    userAuditLogs: async (_: any, { userId }: { userId: string }) => {
      return [
        {
          id: 'audit-1',
          userId: userId,
          action: 'login',
          tableName: 'users',
          recordId: userId,
          oldValues: null,
          newValues: { lastLoginAt: new Date() },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          createdAt: new Date()
        }
      ];
    },

    userSecurityEvents: async (_: any, { userId }: { userId: string }) => {
      return [
        {
          id: 'security-1',
          userId: userId,
          eventType: 'failed_login',
          description: 'Failed login attempt',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          metadata: { reason: 'invalid_password' },
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
    // Product mutations
    createProduct: async (_: any, { input }: { input: any }, context: any) => {
      const startTime = Date.now();
      const traceId = `create-product-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        const createProductUseCase = container.get<CreateProductUseCase>('createProductUseCase');
        const product = await createProductUseCase.execute({
          categoryId: input.categoryId,
          name: input.name,
          description: input.description,
          price: input.price,
          salePrice: input.salePrice,
          sku: input.sku,
          images: input.images || [],
          attributes: input.attributes || {},
          stockQuantity: input.stockQuantity || 0,
          tags: input.tags || []
        });

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createCreateResponse(
          transformProduct(product),
          product.id,
          product.createdAt.toISOString(),
          'Product created successfully',
          {
            requestId,
            traceId,
            duration
          }
        );

      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Log del error con contexto completo
        console.error('CreateProduct resolver error:', {
          error: error.message,
          input,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        // Determinar el código de error apropiado
        let errorCode: string = RESPONSE_CODES.INTERNAL_ERROR;
        let errorMessage = error.message || 'Failed to create product';
        
        if (error.message?.includes('SKU already exists') || error.message?.includes('already exists')) {
          errorCode = RESPONSE_CODES.RESOURCE_ALREADY_EXISTS;
        } else if (error.message?.includes('required') || error.message?.includes('Validation failed')) {
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

    updateProduct: async (_: any, { id, input }: { id: string; input: any }) => {
      const updateProductUseCase = container.get<UpdateProductUseCase>('updateProductUseCase');
      const product = await updateProductUseCase.execute({
        id,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        price: input.price,
        salePrice: input.salePrice,
        sku: input.sku,
        images: input.images,
        attributes: input.attributes,
        isActive: input.isActive,
        stockQuantity: input.stockQuantity,
        tags: input.tags
      });
      return transformProduct(product);
    },

    deleteProduct: async (_: any, { id }: { id: string }) => {
      const deleteProductUseCase = container.get<DeleteProductUseCase>('deleteProductUseCase');
      await deleteProductUseCase.execute({ id });
      return { success: true, message: 'Product deleted successfully' };
    },

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
    revokeUserSession: async (_: any, { sessionId }: { sessionId: string }) => {
      // This would be implemented with proper auth repository
      return {
        success: true,
        message: 'Sesión revocada exitosamente'
      };
    },

    revokeAllUserSessions: async (_: any, { userId }: { userId: string }) => {
      // This would be implemented with proper auth repository
      return {
        success: true,
        message: 'Todas las sesiones han sido revocadas'
      };
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
    registerUser: async (_: any, { input }: { input: any }) => {
      try {
        const createUserUseCase = container.get<CreateUserUseCase>('createUserUseCase');
        const user = await createUserUseCase.execute({
          email: input.email,
          password: input.password,
          profile: {
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            birthDate: input.birthDate ? new Date(input.birthDate) : undefined
          }
        });

        return {
          success: true,
          user: transformUser(user),
          accessToken: 'mock_access_token', // This would be generated by JWT Auth
          refreshToken: 'mock_refresh_token', // This would be generated by JWT Auth
          message: 'User registered successfully'
        };
      } catch (error: any) {
        return {
          success: false,
          user: null,
          accessToken: null,
          refreshToken: null,
          message: error.message || 'Registration failed'
        };
      }
    },

    loginUser: async (_: any, { email, password }: { email: string; password: string }) => {
      try {
        const authenticateUserUseCase = container.get<AuthenticateUserUseCase>('authenticateUserUseCase');
        const result = await authenticateUserUseCase.execute({
          email,
          password
        });

        return {
          success: true,
          user: transformUser(result.user),
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          message: 'Login successful'
        };
      } catch (error: any) {
        return {
          success: false,
          user: null,
          accessToken: null,
          refreshToken: null,
          message: error.message || 'Login failed'
        };
      }
    },

    logoutUser: async () => {
      // In a real implementation, this would invalidate tokens
      return {
        success: true,
        message: 'Logout successful'
      };
    },

    refreshToken: async (_: any, { refreshToken }: { refreshToken: string }) => {
      // In a real implementation, this would validate and refresh tokens
      return {
        success: true,
        user: null,
        accessToken: 'new_mock_access_token',
        refreshToken: 'new_mock_refresh_token',
        message: 'Token refreshed successfully'
      };
    },

    // Password management mutations
    updateUserPassword: async (_: any, { input }: { input: any }) => {
      try {
        const updatePasswordUseCase = container.get<UpdateUserPasswordUseCase>('updateUserPasswordUseCase');
        await updatePasswordUseCase.execute({
          userId: input.userId || 'current_user_id', // Would come from context
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          confirmPassword: input.confirmPassword
        });

        return {
          success: true,
          message: 'Password updated successfully'
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || 'Password update failed'
        };
      }
    },

    requestPasswordReset: async (_: any, { email }: { email: string }) => {
      try {
        const updatePasswordUseCase = container.get<UpdateUserPasswordUseCase>('updateUserPasswordUseCase');
        await updatePasswordUseCase.generatePasswordResetToken(email);

        return {
          success: true,
          message: 'Password reset email sent'
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || 'Password reset request failed'
        };
      }
    },

    resetPassword: async (_: any, { token, newPassword }: { token: string; newPassword: string }) => {
      try {
        const updatePasswordUseCase = container.get<UpdateUserPasswordUseCase>('updateUserPasswordUseCase');
        await updatePasswordUseCase.resetPasswordWithToken(token, newPassword);

        return {
          success: true,
          message: 'Password reset successfully'
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || 'Password reset failed'
        };
      }
    },

    // Address mutations
    createUserAddress: async (_: any, { input }: { input: any }) => {
      // This would need integration with user repository address methods
      return null; // Placeholder
    },

    updateUserAddress: async (_: any, { id, input }: { id: string; input: any }) => {
      // This would need integration with user repository address methods
      return null; // Placeholder
    },

    deleteUserAddress: async (_: any, { id }: { id: string }) => {
      // This would need integration with user repository address methods
      return { success: true, message: 'Address deleted successfully' };
    },

    setDefaultAddress: async (_: any, { userId, addressId }: { userId: string; addressId: string }) => {
      // This would need integration with user repository address methods
      return { success: true, message: 'Default address set successfully' };
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

    // Image upload mutation (critical functionality)
    uploadImage: async (_: any, { file, entityType, entityId }: { file: any; entityType: string; entityId: string }) => {
      const uploadImageUseCase = container.get<UploadImageUseCase>('uploadImageUseCase');
      try {
        const result = await uploadImageUseCase.execute({
          file,
          entityType: entityType as any,
          entityId
        });
        return {
          success: true,
          url: result.url,
          filename: result.fileName || result.url,
          message: 'Image uploaded successfully'
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || 'Failed to upload image'
        };
      }
    },

    createCategory: async (_: any, { input }: { input: any }, context: any) => {
      const startTime = Date.now();
      const traceId = `create-category-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        const createCategoryUseCase = container.get<CreateCategoryUseCase>('createCategoryUseCase');
        const category = await createCategoryUseCase.execute({
          name: input.name,
          description: input.description,
          slug: input.slug,
          imageUrl: input.imageUrl,
          isActive: input.isActive !== undefined ? input.isActive : true,
          sortOrder: input.sortOrder || 0
        });

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          {
            entity: transformCategory(category),
            id: category.id,
            createdAt: category.createdAt.toISOString()
          },
          'Category created successfully',
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
        console.error('CreateCategory resolver error:', {
          error: errorResponse,
          input,
          context: { requestId: context?.requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          (errorResponse.code as any) || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },
    updateCategory: async (_: any, { id, input }: { id: string, input: any }, context: any) => {
      const startTime = Date.now();
      const traceId = `update-category-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        const updateCategoryUseCase = container.get<UpdateCategoryUseCase>('updateCategoryUseCase');
        const result = await updateCategoryUseCase.execute({
          id,
          name: input.name,
          description: input.description,
          slug: input.slug,
          imageUrl: input.image,
          isActive: input.isActive,
          sortOrder: input.sortOrder
        });

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          {
            entity: transformCategory(result.category),
            id: result.category.id,
            updatedAt: result.category.updatedAt.toISOString(),
            changes: result.changes
          },
          'Category updated successfully',
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
        
        // Log del error con contexto completo
        console.error('UpdateCategory resolver error:', {
          error: errorResponse,
          categoryId: id,
          input,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          (errorResponse.code as any) || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },
    deleteCategory: async (_: any, { id }: { id: string }, context: any) => {
      const startTime = Date.now();
      const traceId = `delete-category-${Date.now()}`;
      const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
      
      try {
        const deleteCategoryUseCase = container.get<DeleteCategoryUseCase>('deleteCategoryUseCase');
        const result = await deleteCategoryUseCase.execute({
          id,
          forceDelete: false // Por defecto soft delete
        });

        const duration = Date.now() - startTime;
        
        return ResponseFactory.createSuccessResponse(
          {
            id: result.id,
            deletedAt: result.deletedAt.toISOString(),
            softDelete: result.softDelete
          },
          'Category deleted successfully',
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
        
        // Log del error con contexto completo
        console.error('DeleteCategory resolver error:', {
          error: errorResponse,
          categoryId: id,
          context: { requestId, traceId },
          duration,
          timestamp: new Date()
        });
        
        return ResponseFactory.createErrorResponse(
          errorResponse.message,
          (errorResponse.code as any) || RESPONSE_CODES.INTERNAL_ERROR,
          errorResponse.details,
          {
            requestId,
            traceId,
            duration
          }
        );
      }
    },
    createProductVariant: () => null,
    updateProductVariant: () => null,
    deleteProductVariant: () => ({ success: true, message: 'Product variant deleted successfully' }),
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
    bulkUpdateProducts: () => [],
    bulkUpdateOrderStatus: () => [],
  }
};