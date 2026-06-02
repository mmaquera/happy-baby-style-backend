import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { GraphQLError } from 'graphql';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { prisma } from '@hbs/prisma';
import { buildAuthContext } from '@hbs/auth';
import { LoggerFactory, RequestLogger } from '@hbs/logging';
import {
  StreamRecordRuleSource,
  RecordRuleResolver,
  RecordRulesEventsConsumer,
  fetchSnapshotAndPopulate,
} from '@hbs/authz';
import { PrismaCategoryRepository } from './infrastructure/repositories/PrismaCategoryRepository';
import { typeDefs } from './graphql/schema';
import { createResolvers } from './graphql/resolvers';

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start.');
  process.exit(1);
}

if (!process.env.REDIS_URL) {
  console.error('FATAL: REDIS_URL is not set. Refusing to start.');
  process.exit(1);
}

if (!process.env.USER_SERVICE_INTERNAL_URL) {
  console.error('FATAL: USER_SERVICE_INTERNAL_URL is not set. Refusing to start.');
  process.exit(1);
}

const PORT = parseInt(process.env.CATEGORY_SERVICE_PORT || '3002', 10);
const FRONTEND_URLS = (process.env.FRONTEND_URLS || 'http://localhost:3000')
  .split(',')
  .map((u) => u.trim());
const REDIS_URL = process.env.REDIS_URL;
const RBAC_STREAM_NAME = process.env.RBAC_STREAM_NAME ?? 'stream:record-rules-updated';
const HOSTNAME = process.env.HOSTNAME ?? `category-service-${process.pid}`;

async function start() {
  const serviceLogger = LoggerFactory.getInstance().createServiceLogger('category-service');

  // Redis client — required for RBAC cache invalidation.
  const redisClient = new Redis(REDIS_URL);
  redisClient.on('error', (err) =>
    serviceLogger.error('Redis client error', err as Error, { service: 'category-service' }),
  );

  // RBAC: StreamRecordRuleSource is the in-memory store hydrated by Redis Stream events.
  // Option D boot snapshot: fetch all active rules from user-service before starting
  // the consumer so rules created while this service was offline are not missed.
  const recordRuleSource = new StreamRecordRuleSource();
  const recordRuleResolver = new RecordRuleResolver(recordRuleSource);

  const userServiceInternalUrl = process.env.USER_SERVICE_INTERNAL_URL!;
  const snapshotResult = await fetchSnapshotAndPopulate(recordRuleSource, serviceLogger, {
    userServiceUrl: userServiceInternalUrl,
  });
  if (!snapshotResult.success) {
    serviceLogger.error(
      'FATAL: RBAC snapshot fetch failed after all retries. Refusing to start with an empty rule set (fail-closed).',
      new Error('snapshot_unavailable'),
      { service: 'category-service', userServiceUrl: userServiceInternalUrl },
    );
    process.exit(1);
  }

  const rbacConsumer = new RecordRulesEventsConsumer(
    redisClient,
    recordRuleResolver,
    serviceLogger,
    {
      streamName: RBAC_STREAM_NAME,
      consumerGroup: 'category-service-rbac-cg',
      consumerName: HOSTNAME,
    },
    recordRuleSource, // pass streamSource so consumer applies payloads to the local cache
  );
  await rbacConsumer.start();

  const categoryRepository = new PrismaCategoryRepository(prisma, recordRuleResolver);
  const resolvers = createResolvers(categoryRepository);

  const schema = buildSubgraphSchema([{ typeDefs, resolvers: resolvers as any }]);

  const authPlugin = {
    async requestDidStart() {
      return {
        async didResolveOperation({ contextValue, operation }: any) {
          if (operation.operation === 'mutation' && !contextValue.currentUser) {
            throw new GraphQLError('Authentication required', {
              extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
            });
          }
        },
      };
    },
  };

  const server = new ApolloServer({
    schema,
    introspection: process.env.NODE_ENV !== 'production',
    includeStacktraceInErrorResponses: process.env.NODE_ENV === 'development',
    plugins: [authPlugin],
  });
  await server.start();

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
        ? 'loopback' // coerce unsafe 'true' to safe default in subgraphs
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
    res.json({ status: 'OK', service: 'category-service', port: PORT });
  });

  app.use(
    '/graphql',
    express.json({ limit: '2mb' }),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const { currentUser } = buildAuthContext(req.headers.authorization);
        return { req, currentUser };
      },
    }),
  );

  const httpServer = app.listen(PORT, () => {
    serviceLogger.info(`category-service running at http://localhost:${PORT}/graphql`);
  });

  const shutdown = async () => {
    serviceLogger.info('category-service shutting down…');
    await rbacConsumer.stop();
    await redisClient.quit().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('category-service failed to start:', err);
  process.exit(1);
});
