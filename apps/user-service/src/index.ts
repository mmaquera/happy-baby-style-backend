import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { LoggerFactory, RequestLogger } from '@hbs/logging';
import { buildAuthContext } from '@hbs/auth';
import { RecordRuleResolver, RecordRulesEventsConsumer } from '@hbs/authz';
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
import { UnlockUserAccountUseCase } from './application/use-cases/user/UnlockUserAccountUseCase';
import { RequestEmailVerificationUseCase } from './application/use-cases/user/RequestEmailVerificationUseCase';
import { VerifyEmailUseCase } from './application/use-cases/user/VerifyEmailUseCase';
import { ResendVerificationEmailUseCase } from './application/use-cases/user/ResendVerificationEmailUseCase';
import { EnableMfaUseCase } from './application/use-cases/user/EnableMfaUseCase';
import { VerifyMfaSetupUseCase } from './application/use-cases/user/VerifyMfaSetupUseCase';
import { DisableMfaUseCase } from './application/use-cases/user/DisableMfaUseCase';
import { VerifyTotpUseCase } from './application/use-cases/user/VerifyTotpUseCase';
import { RedisMfaChallengeStore } from './infrastructure/adapters/RedisMfaChallengeStore';
import { EffectivePermissionsResolver } from './infrastructure/repositories/EffectivePermissionsResolver';
import { PrismaRecordRuleSource } from './infrastructure/repositories/PrismaRecordRuleSource';
import { RedisRecordRulesEventPublisher } from './infrastructure/messaging/RecordRulesEventPublisher';
import { GeoIpLiteAdapter } from './infrastructure/adapters/GeoIpLiteAdapter';
import { PrismaAuthzRepository } from './infrastructure/repositories/PrismaAuthzRepository';
import { CreateGroupUseCase } from './application/use-cases/authz/CreateGroupUseCase';
import { UpdateGroupUseCase } from './application/use-cases/authz/UpdateGroupUseCase';
import { DeleteGroupUseCase } from './application/use-cases/authz/DeleteGroupUseCase';
import { ListGroupsUseCase } from './application/use-cases/authz/ListGroupsUseCase';
import { CreatePermissionUseCase } from './application/use-cases/authz/CreatePermissionUseCase';
import { UpdatePermissionUseCase } from './application/use-cases/authz/UpdatePermissionUseCase';
import { DeletePermissionUseCase } from './application/use-cases/authz/DeletePermissionUseCase';
import { ListPermissionsUseCase } from './application/use-cases/authz/ListPermissionsUseCase';
import { AssignUserToGroupUseCase } from './application/use-cases/authz/AssignUserToGroupUseCase';
import { RemoveUserFromGroupUseCase } from './application/use-cases/authz/RemoveUserFromGroupUseCase';
import { ListUserGroupsUseCase } from './application/use-cases/authz/ListUserGroupsUseCase';
import { AssignPermissionToGroupUseCase } from './application/use-cases/authz/AssignPermissionToGroupUseCase';
import { RevokePermissionFromGroupUseCase } from './application/use-cases/authz/RevokePermissionFromGroupUseCase';
import { ListGroupPermissionsUseCase } from './application/use-cases/authz/ListGroupPermissionsUseCase';
import { AddGroupImplicationUseCase } from './application/use-cases/authz/AddGroupImplicationUseCase';
import { RemoveGroupImplicationUseCase } from './application/use-cases/authz/RemoveGroupImplicationUseCase';
import { CreateRecordRuleUseCase } from './application/use-cases/authz/CreateRecordRuleUseCase';
import { UpdateRecordRuleUseCase } from './application/use-cases/authz/UpdateRecordRuleUseCase';
import { DeleteRecordRuleUseCase } from './application/use-cases/authz/DeleteRecordRuleUseCase';
import { ListRecordRulesUseCase } from './application/use-cases/authz/ListRecordRulesUseCase';

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

const mfaEncKey = process.env.MFA_ENC_KEY;
if (!mfaEncKey || mfaEncKey.length !== 64) {
  console.error('FATAL: MFA_ENC_KEY must be a 64-char hex string (32 bytes). Refusing to start.');
  process.exit(1);
}

if (!process.env.REDIS_URL) {
  console.error('FATAL: REDIS_URL environment variable is not set. Refusing to start.');
  process.exit(1);
}

const PORT = parseInt(process.env.USER_SERVICE_PORT || '3006', 10);
const RBAC_STREAM_NAME = process.env.RBAC_STREAM_NAME ?? 'stream:record-rules-updated';
const RBAC_CACHE_TTL_MS = parseInt(process.env.RBAC_CACHE_TTL_MS ?? '300000', 10);
const FRONTEND_URLS = (process.env.FRONTEND_URLS || 'http://localhost:3000').split(',');
const HOSTNAME = process.env.HOSTNAME ?? `user-service-${process.pid}`;

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
  const requestLogger = new RequestLogger();

  // Trust proxy: controls how req.ip is derived behind a reverse proxy/load balancer.
  // 'loopback' (default) trusts only 127.0.0.1 / ::1; set TRUST_PROXY=1 when behind
  // a single nginx/ALB hop in production. Never set to true — allows IP spoofing.
  const rawTrustProxy = process.env.TRUST_PROXY;
  const trustProxy: string | number | boolean = !rawTrustProxy
    ? 'loopback'
    : rawTrustProxy === 'false'
      ? false
      : rawTrustProxy === 'true'
        ? 'loopback'
        : (isNaN(parseInt(rawTrustProxy, 10)) ? rawTrustProxy : parseInt(rawTrustProxy, 10));
  app.set('trust proxy', trustProxy);

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(
    cors({
      origin: FRONTEND_URLS,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(requestLogger.middleware());

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', service: 'User Service', port: PORT });
  });

  const prisma = new PrismaClient();
  const useCaseLogger = LoggerFactory.getInstance().createUseCaseLogger('user-service');
  const serviceLogger = LoggerFactory.getInstance().createServiceLogger('user-service');

  // Redis — required for RBAC cache invalidation events (Fase 5.7)
  const redisClient = new Redis(process.env.REDIS_URL!);
  redisClient.on('error', err =>
    serviceLogger.error('Redis client error', err as Error, { service: 'user-service' }),
  );

  // RBAC — RecordRule publisher + resolver (wired to mutations in Fase 5.10, to repos in Fase 5.8)
  const recordRulePublisher = new RedisRecordRulesEventPublisher(redisClient, serviceLogger, {
    streamName: RBAC_STREAM_NAME,
  });
  // user-service has direct DB access → use real Prisma source (not EmptyRecordRuleSource).
  const recordRuleSource = new PrismaRecordRuleSource(prisma);
  const recordRuleResolver = new RecordRuleResolver(recordRuleSource, {
    cacheTtlMs: RBAC_CACHE_TTL_MS,
  });
  // Consumer: user-service is the publisher, but still needs to refresh its own cache
  // when rules change (in case of multi-replica deployments).
  const rbacConsumer = new RecordRulesEventsConsumer(redisClient, recordRuleResolver, serviceLogger, {
    streamName: RBAC_STREAM_NAME,
    consumerGroup: 'user-service-rbac-cg',
    consumerName: HOSTNAME,
  });
  // Repositories
  const userRepository = new PrismaUserProfileRepository(prisma);
  const authRepository = new PrismaAuthRepository(prisma);
  const auditRepository = new PrismaAuditRepository(prisma);
  const securityEventRepository = new PrismaSecurityEventRepository(prisma);
  const userFavoritesRepository = new PrismaUserFavoritesRepository(prisma);
  const effectivePermissionsResolver = new EffectivePermissionsResolver(prisma);

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
  const geoIpAdapter = new GeoIpLiteAdapter();
  const mfaChallengeStore = new RedisMfaChallengeStore(redisClient, serviceLogger);
  const authenticateUserUseCase = new AuthenticateUserUseCase(
    userRepository,
    authRepository,
    useCaseLogger,
    effectivePermissionsResolver,
    securityEventRepository,
    geoIpAdapter,
    mfaChallengeStore,
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
  const refreshTokenUseCase = new RefreshTokenUseCase(
    authRepository,
    useCaseLogger,
    effectivePermissionsResolver,
  );
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
  const unlockUserAccountUseCase = new UnlockUserAccountUseCase(
    userRepository,
    securityEventRepository,
    useCaseLogger,
  );

  // Email verification use cases (WS2)
  const requestEmailVerificationUseCase = new RequestEmailVerificationUseCase(
    userRepository,
    emailService,
    securityEventRepository,
    useCaseLogger,
  );
  const verifyEmailUseCase = new VerifyEmailUseCase(
    userRepository,
    securityEventRepository,
    useCaseLogger,
  );
  const resendVerificationEmailUseCase = new ResendVerificationEmailUseCase(
    userRepository,
    emailService,
    securityEventRepository,
    useCaseLogger,
  );

  // MFA use cases (WS3)
  const enableMfaUseCase = new EnableMfaUseCase(userRepository, useCaseLogger);
  const verifyMfaSetupUseCase = new VerifyMfaSetupUseCase(
    userRepository,
    securityEventRepository,
    useCaseLogger,
  );
  const disableMfaUseCase = new DisableMfaUseCase(
    userRepository,
    securityEventRepository,
    useCaseLogger,
  );
  const verifyTotpUseCase = new VerifyTotpUseCase(
    userRepository,
    authRepository,
    securityEventRepository,
    mfaChallengeStore,
    effectivePermissionsResolver,
    useCaseLogger,
  );

  // RBAC admin infrastructure + use cases (Fase 5.10)
  const authzRepository = new PrismaAuthzRepository(prisma);

  const createGroupUseCase = new CreateGroupUseCase(authzRepository);
  const updateGroupUseCase = new UpdateGroupUseCase(authzRepository);
  const deleteGroupUseCase = new DeleteGroupUseCase(authzRepository);
  const listGroupsUseCase = new ListGroupsUseCase(authzRepository);

  const createPermissionUseCase = new CreatePermissionUseCase(authzRepository);
  const updatePermissionUseCase = new UpdatePermissionUseCase(authzRepository);
  const deletePermissionUseCase = new DeletePermissionUseCase(authzRepository);
  const listPermissionsUseCase = new ListPermissionsUseCase(authzRepository);

  const assignUserToGroupUseCase = new AssignUserToGroupUseCase(authzRepository);
  const removeUserFromGroupUseCase = new RemoveUserFromGroupUseCase(authzRepository);
  const listUserGroupsUseCase = new ListUserGroupsUseCase(authzRepository);

  const assignPermissionToGroupUseCase = new AssignPermissionToGroupUseCase(authzRepository);
  const revokePermissionFromGroupUseCase = new RevokePermissionFromGroupUseCase(authzRepository);
  const listGroupPermissionsUseCase = new ListGroupPermissionsUseCase(authzRepository);

  const addGroupImplicationUseCase = new AddGroupImplicationUseCase(authzRepository);
  const removeGroupImplicationUseCase = new RemoveGroupImplicationUseCase(authzRepository);

  // Record rule use cases — inject publisher for cache invalidation events.
  const createRecordRuleUseCase = new CreateRecordRuleUseCase(authzRepository, recordRulePublisher);
  const updateRecordRuleUseCase = new UpdateRecordRuleUseCase(authzRepository, recordRulePublisher);
  const deleteRecordRuleUseCase = new DeleteRecordRuleUseCase(authzRepository, recordRulePublisher);
  const listRecordRulesUseCase = new ListRecordRulesUseCase(authzRepository);

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
    // RBAC admin use cases
    createGroupUseCase,
    updateGroupUseCase,
    deleteGroupUseCase,
    listGroupsUseCase,
    createPermissionUseCase,
    updatePermissionUseCase,
    deletePermissionUseCase,
    listPermissionsUseCase,
    assignUserToGroupUseCase,
    removeUserFromGroupUseCase,
    listUserGroupsUseCase,
    assignPermissionToGroupUseCase,
    revokePermissionFromGroupUseCase,
    listGroupPermissionsUseCase,
    addGroupImplicationUseCase,
    removeGroupImplicationUseCase,
    createRecordRuleUseCase,
    updateRecordRuleUseCase,
    deleteRecordRuleUseCase,
    listRecordRulesUseCase,
    unlockUserAccountUseCase,
    // Email verification (WS2)
    requestEmailVerificationUseCase,
    verifyEmailUseCase,
    resendVerificationEmailUseCase,
    // MFA (WS3)
    enableMfaUseCase,
    verifyMfaSetupUseCase,
    disableMfaUseCase,
    verifyTotpUseCase,
  });

  const server = new ApolloServer({
    schema: buildSubgraphSchema([{ typeDefs, resolvers: resolvers as any }]),
    introspection: process.env.NODE_ENV !== 'production',
    includeStacktraceInErrorResponses: process.env.NODE_ENV === 'development',
  });

  await server.start();

  // Internal endpoint for subgraph snapshot-on-boot of record rules.
  // NOT exposed via gateway. Protected by Docker network isolation.
  // See Fase 5.7.x + Gap #6 design.
  app.get('/internal/record-rules', async (_req, res) => {
    try {
      const rules = await recordRuleSource.loadAllActive();
      res.json({ rules });
    } catch (error) {
      serviceLogger.error('Failed to serve record-rules snapshot', error as Error);
      res.status(500).json({ error: 'snapshot_failed' });
    }
  });

  // Start RBAC consumer — fire-and-forget after ensureGroup() + initial refresh.
  await rbacConsumer.start();

  app.use(
    '/graphql',
    express.json({ limit: '10mb' }),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const { currentUser } = buildAuthContext(req.headers.authorization);
        return { req, currentUser };
      },
    }),
  );

  const httpServer = app.listen(PORT, () => {
    logger.info(`User Service running at http://localhost:${PORT}/graphql`);
  });

  const shutdown = async () => {
    serviceLogger.info('User Service shutting down…');
    await rbacConsumer.stop();
    await redisClient.quit().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('User Service failed to start:', err);
  process.exit(1);
});
