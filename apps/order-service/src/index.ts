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
import { StreamRecordRuleSource, RecordRuleResolver, RecordRulesEventsConsumer, fetchSnapshotAndPopulate } from '@hbs/authz';
import { typeDefs } from './graphql/schema';
import { createResolvers } from './graphql/resolvers';
import { PrismaOrderRepository } from './infrastructure/repositories/PrismaOrderRepository';
import { HttpProductValidationAdapter } from './infrastructure/adapters/HttpProductValidationAdapter';
import { RedisEventPublisher } from './infrastructure/adapters/RedisEventPublisher';

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start.');
  process.exit(1);
}

if (!process.env.REDIS_URL) {
  console.error('FATAL: REDIS_URL is not set. Refusing to start.');
  process.exit(1);
}

const PORT = parseInt(process.env.ORDER_SERVICE_PORT || '3005', 10);
const FRONTEND_URLS = (process.env.FRONTEND_URLS || 'http://localhost:3000').split(',');
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003/graphql';
const REDIS_URL = process.env.REDIS_URL;
const RBAC_STREAM_NAME = process.env.RBAC_STREAM_NAME ?? 'stream:record-rules-updated';
const HOSTNAME = process.env.HOSTNAME ?? `order-service-${process.pid}`;

async function start() {
  const serviceLogger = LoggerFactory.getInstance().createServiceLogger('order-service');
  const app = express();
  const requestLogger = new RequestLogger();

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
    res.json({ status: 'OK', service: 'Order Service', port: PORT });
  });

  const redisClient = new Redis(REDIS_URL);
  redisClient.on('error', (err) =>
    serviceLogger.error('Redis client error', err as Error, { service: 'order-service' }),
  );

  // RBAC: StreamRecordRuleSource is the in-memory store hydrated by Redis Stream events.
  // Option D boot snapshot: fetch all active rules from user-service before starting
  // the consumer so rules created while this service was offline are not missed.
  const recordRuleSource = new StreamRecordRuleSource();
  const recordRuleResolver = new RecordRuleResolver(recordRuleSource);

  const userServiceInternalUrl = process.env.USER_SERVICE_INTERNAL_URL;
  if (userServiceInternalUrl) {
    await fetchSnapshotAndPopulate(recordRuleSource, serviceLogger, {
      userServiceUrl: userServiceInternalUrl,
    });
  } else {
    serviceLogger.warn(
      'USER_SERVICE_INTERNAL_URL not set — skipping RBAC snapshot fetch. Cache will fill from stream events only.',
      { service: 'order-service' },
    );
  }

  const rbacConsumer = new RecordRulesEventsConsumer(
    redisClient,
    recordRuleResolver,
    serviceLogger,
    {
      streamName: RBAC_STREAM_NAME,
      consumerGroup: 'order-service-rbac-cg',
      consumerName: HOSTNAME,
    },
    recordRuleSource, // pass streamSource so consumer applies payloads to the local cache
  );
  await rbacConsumer.start();

  const orderRepository = new PrismaOrderRepository(prisma, recordRuleResolver);
  const productValidation = new HttpProductValidationAdapter(PRODUCT_SERVICE_URL);
  const eventPublisher = new RedisEventPublisher(redisClient);

  const resolvers = createResolvers(orderRepository, productValidation, eventPublisher, prisma);

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
    schema: buildSubgraphSchema([{ typeDefs, resolvers: resolvers as any }]),
    introspection: process.env.NODE_ENV !== 'production',
    includeStacktraceInErrorResponses: process.env.NODE_ENV === 'development',
    plugins: [authPlugin],
  });

  await server.start();

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
    serviceLogger.info(`order-service running at http://localhost:${PORT}/graphql`);
    serviceLogger.info(`Product validation via: ${PRODUCT_SERVICE_URL}`);
  });

  const shutdown = async () => {
    serviceLogger.info('order-service shutting down…');
    await rbacConsumer.stop();
    await redisClient.quit().catch(() => undefined);
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Order Service failed to start:', err);
  process.exit(1);
});
