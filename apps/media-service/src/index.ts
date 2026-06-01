import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as path from 'path';
import { GraphQLError } from 'graphql';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { graphqlUploadExpress } from 'graphql-upload-cjs';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { prisma } from '@hbs/prisma';
import { buildAuthContext } from '@hbs/auth';
import { LoggerFactory, RequestLogger } from '@hbs/logging';
import { EmptyRecordRuleSource, RecordRuleResolver, RecordRulesEventsConsumer } from '@hbs/authz';
import { typeDefs } from './graphql/schema';
import { createResolvers } from './graphql/resolvers';
import { PrismaImageRepository } from './infrastructure/repositories/PrismaImageRepository';
import { PrismaSvgRepository } from './infrastructure/repositories/PrismaSvgRepository';
import { LocalStorageService } from './infrastructure/services/LocalStorageService';

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start.');
  process.exit(1);
}

if (!process.env.REDIS_URL) {
  console.error('FATAL: REDIS_URL is not set. Refusing to start.');
  process.exit(1);
}

const PORT = parseInt(process.env.MEDIA_SERVICE_PORT || '3004', 10);
const FRONTEND_URLS = (process.env.FRONTEND_URLS || 'http://localhost:3000').split(',');
const REDIS_URL = process.env.REDIS_URL;
const RBAC_STREAM_NAME = process.env.RBAC_STREAM_NAME ?? 'stream:record-rules-updated';
const HOSTNAME = process.env.HOSTNAME ?? `media-service-${process.pid}`;

async function start() {
  const serviceLogger = LoggerFactory.getInstance().createServiceLogger('media-service');
  const app = express();
  const requestLogger = new RequestLogger();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

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
    res.json({ status: 'OK', service: 'Media Service', port: PORT });
  });

  // Serve uploaded files statically
  const uploadsPath = path.join(process.cwd(), 'uploads');
  app.use(
    '/uploads',
    express.static(uploadsPath, {
      maxAge: '1d',
      etag: true,
      setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
      },
    }),
  );

  // Redis client — required for RBAC cache invalidation (Fase 5.7.2).
  const redisClient = new Redis(REDIS_URL);
  redisClient.on('error', (err) =>
    serviceLogger.error('Redis client error', err as Error, { service: 'media-service' }),
  );

  // RBAC cache invalidation consumer.
  // TODO Fase 5.10: replace EmptyRecordRuleSource with a hydrated source that
  // fetches rules from user-service on boot and re-fetches on invalidation events.
  const recordRuleSource = new EmptyRecordRuleSource();
  const recordRuleResolver = new RecordRuleResolver(recordRuleSource);
  const rbacConsumer = new RecordRulesEventsConsumer(redisClient, recordRuleResolver, serviceLogger, {
    streamName: RBAC_STREAM_NAME,
    consumerGroup: 'media-service-rbac-cg',
    consumerName: HOSTNAME,
  });
  await rbacConsumer.start();

  const imageRepository = new PrismaImageRepository(prisma);
  const svgRepository = new PrismaSvgRepository(prisma);
  const storageService = new LocalStorageService();

  const resolvers = createResolvers(imageRepository, svgRepository, storageService);

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
    graphqlUploadExpress({ maxFileSize: 10 * 1024 * 1024, maxFiles: 10 }),
    express.json({ limit: '10mb' }),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const { currentUser } = buildAuthContext(req.headers.authorization);
        return { req, currentUser };
      },
    }),
  );

  const httpServer = app.listen(PORT, () => {
    serviceLogger.info(`media-service running at http://localhost:${PORT}/graphql`);
  });

  const shutdown = async () => {
    serviceLogger.info('media-service shutting down…');
    await rbacConsumer.stop();
    await redisClient.quit().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Media Service failed to start:', err);
  process.exit(1);
});
