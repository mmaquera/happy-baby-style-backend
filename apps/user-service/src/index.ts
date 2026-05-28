import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { LoggerFactory } from '@hbs/logging';
import { typeDefs } from './graphql/schema';
import { createResolvers } from './graphql/resolvers';
import { PrismaUserProfileRepository } from './infrastructure/repositories/PrismaUserProfileRepository';
import { PrismaAuthRepository } from './infrastructure/repositories/PrismaAuthRepository';
import { PrismaAuditRepository } from './infrastructure/repositories/PrismaAuditRepository';
import { PrismaSecurityEventRepository } from './infrastructure/repositories/PrismaSecurityEventRepository';
import { PrismaUserFavoritesRepository } from './infrastructure/repositories/PrismaUserFavoritesRepository';
import { NodemailerEmailService } from './infrastructure/services/NodemailerEmailService';
import { CreateUserUseCase } from './application/use-cases/user/CreateUserUseCase';
import { GetUsersUseCase } from './application/use-cases/user/GetUsersUseCase';
import { GetUserByIdUseCase } from './application/use-cases/user/GetUserByIdUseCase';
import { UpdateUserUseCase } from './application/use-cases/user/UpdateUserUseCase';
import { GetUserStatsUseCase } from './application/use-cases/user/GetUserStatsUseCase';
import { AuthenticateUserUseCase } from './application/use-cases/user/AuthenticateUserUseCase';
import { UpdateUserPasswordUseCase } from './application/use-cases/user/UpdateUserPasswordUseCase';
import { SetUserPasswordUseCase } from './application/use-cases/user/SetUserPasswordUseCase';
import { LogoutUserUseCase } from './application/use-cases/user/LogoutUserUseCase';
import { RefreshTokenUseCase } from './application/use-cases/user/RefreshTokenUseCase';
import { CreateUserAddressUseCase } from './application/use-cases/user/CreateUserAddressUseCase';
import { UpdateUserAddressUseCase } from './application/use-cases/user/UpdateUserAddressUseCase';
import { DeleteUserAddressUseCase } from './application/use-cases/user/DeleteUserAddressUseCase';
import { GetUserAddressByIdUseCase } from './application/use-cases/user/GetUserAddressByIdUseCase';
import { SetDefaultAddressUseCase } from './application/use-cases/user/SetDefaultAddressUseCase';
import {
  GetUserOrderHistoryUseCase,
  IUserOrderRepository,
} from './application/use-cases/user/GetUserOrderHistoryUseCase';
import { CreateUserSessionAnalyticsUseCase } from './application/use-cases/user/CreateUserSessionAnalyticsUseCase';
import { UpdateUserSessionAnalyticsUseCase } from './application/use-cases/user/UpdateUserSessionAnalyticsUseCase';
import { GetUserSessionAnalyticsUseCase } from './application/use-cases/user/GetUserSessionAnalyticsUseCase';
import { RevokeUserSessionUseCase } from './application/use-cases/user/RevokeUserSessionUseCase';
import { RevokeAllUserSessionsUseCase } from './application/use-cases/user/RevokeAllUserSessionsUseCase';
import { ManageUserFavoritesUseCase } from './application/use-cases/user/ManageUserFavoritesUseCase';

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

const PORT = parseInt(process.env.USER_SERVICE_PORT || '3006', 10);
const FRONTEND_URLS = (process.env.FRONTEND_URLS || 'http://localhost:3000').split(',');

// Stub: order history queries route to order-service via federation in production
class StubUserOrderRepository implements IUserOrderRepository {
  async getUserOrders(_params: any) {
    return { orders: [], total: 0 };
  }
  async getUserOrderStats(_userId: string) {
    return { totalOrders: 0, totalSpent: 0, averageOrderValue: 0 };
  }
}

async function start() {
  const logger = LoggerFactory.create('user-service');
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(
    cors({
      origin: FRONTEND_URLS,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', service: 'User Service', port: PORT });
  });

  const prisma = new PrismaClient();
  const useCaseLogger = LoggerFactory.getInstance().createUseCaseLogger('user-service');

  // Repositories
  const userRepository = new PrismaUserProfileRepository(prisma);
  const authRepository = new PrismaAuthRepository(prisma);
  const auditRepository = new PrismaAuditRepository(prisma);
  const securityEventRepository = new PrismaSecurityEventRepository(prisma);
  const userFavoritesRepository = new PrismaUserFavoritesRepository(prisma);

  // Email service
  const emailService = new NodemailerEmailService(
    {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASSWORD || '',
      },
      fromEmail: process.env.SMTP_FROM || 'noreply@happybabystyle.com',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      resetPasswordUrl: process.env.RESET_PASSWORD_URL || 'http://localhost:3000/reset-password',
    },
    useCaseLogger,
  );

  // Use cases
  const createUserUseCase = new CreateUserUseCase(userRepository);
  const getUsersUseCase = new GetUsersUseCase(userRepository);
  const getUserByIdUseCase = new GetUserByIdUseCase(userRepository);
  const updateUserUseCase = new UpdateUserUseCase(userRepository);
  const getUserStatsUseCase = new GetUserStatsUseCase(userRepository);
  const authenticateUserUseCase = new AuthenticateUserUseCase(
    userRepository,
    authRepository,
    useCaseLogger,
  );
  const updateUserPasswordUseCase = new UpdateUserPasswordUseCase(
    authRepository,
    auditRepository,
    securityEventRepository,
    emailService,
    useCaseLogger,
  );
  const setUserPasswordUseCase = new SetUserPasswordUseCase(
    authRepository,
    auditRepository,
    securityEventRepository,
    useCaseLogger,
  );
  const logoutUserUseCase = new LogoutUserUseCase(authRepository, useCaseLogger);
  const refreshTokenUseCase = new RefreshTokenUseCase(authRepository, useCaseLogger);
  const createUserAddressUseCase = new CreateUserAddressUseCase(userRepository);
  const updateUserAddressUseCase = new UpdateUserAddressUseCase(userRepository);
  const deleteUserAddressUseCase = new DeleteUserAddressUseCase(userRepository);
  const getUserAddressByIdUseCase = new GetUserAddressByIdUseCase(userRepository);
  const setDefaultAddressUseCase = new SetDefaultAddressUseCase(userRepository);
  const getUserOrderHistoryUseCase = new GetUserOrderHistoryUseCase(new StubUserOrderRepository());
  const createUserSessionAnalyticsUseCase = new CreateUserSessionAnalyticsUseCase(
    authRepository,
    useCaseLogger,
  );
  const updateUserSessionAnalyticsUseCase = new UpdateUserSessionAnalyticsUseCase(
    authRepository,
    useCaseLogger,
  );
  const getUserSessionAnalyticsUseCase = new GetUserSessionAnalyticsUseCase(
    authRepository,
    useCaseLogger,
  );
  const revokeUserSessionUseCase = new RevokeUserSessionUseCase(authRepository, useCaseLogger);
  const revokeAllUserSessionsUseCase = new RevokeAllUserSessionsUseCase(
    authRepository,
    useCaseLogger,
  );
  const manageUserFavoritesUseCase = new ManageUserFavoritesUseCase(userFavoritesRepository);

  const resolvers = createResolvers({
    prisma,
    userRepository,
    authRepository,
    auditRepository,
    securityEventRepository,
    createUserUseCase,
    getUsersUseCase,
    getUserByIdUseCase,
    updateUserUseCase,
    getUserStatsUseCase,
    authenticateUserUseCase,
    updateUserPasswordUseCase,
    setUserPasswordUseCase,
    logoutUserUseCase,
    refreshTokenUseCase,
    createUserAddressUseCase,
    updateUserAddressUseCase,
    deleteUserAddressUseCase,
    getUserAddressByIdUseCase,
    setDefaultAddressUseCase,
    getUserOrderHistoryUseCase,
    createUserSessionAnalyticsUseCase,
    updateUserSessionAnalyticsUseCase,
    getUserSessionAnalyticsUseCase,
    revokeUserSessionUseCase,
    revokeAllUserSessionsUseCase,
    manageUserFavoritesUseCase,
  });

  const server = new ApolloServer({
    schema: buildSubgraphSchema([{ typeDefs, resolvers: resolvers as any }]),
    introspection: true,
  });

  await server.start();

  app.use(
    '/graphql',
    express.json({ limit: '10mb' }),
    expressMiddleware(server, {
      context: async ({ req }) => ({ req }),
    }),
  );

  app.listen(PORT, () => {
    logger.info(`User Service running at http://localhost:${PORT}/graphql`);
  });
}

start().catch((err) => {
  console.error('User Service failed to start:', err);
  process.exit(1);
});
