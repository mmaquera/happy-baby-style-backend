import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import Redis from 'ioredis';
import { prisma } from '@hbs/prisma';
import { extractTokenFromAuthHeader } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';
import { typeDefs } from './graphql/schema';
import { createResolvers } from './graphql/resolvers';
import { PrismaProductRepository } from './infrastructure/repositories/PrismaProductRepository';
import { ApplyOrderStockUseCase } from './application/use-cases/ApplyOrderStockUseCase';
import { OrderEventsConsumer } from './infrastructure/messaging/OrderEventsConsumer';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start.');
  process.exit(1);
}

const PORT = parseInt(process.env.PRODUCT_SERVICE_PORT || '3003', 10);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function start() {
  const productRepository = new PrismaProductRepository(prisma);
  const resolvers = createResolvers(productRepository, prisma);

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
    plugins: [authPlugin],
  });
  await server.start();

  const redisClient = new Redis(REDIS_URL);
  redisClient.on('error', (err) => console.error('Redis error:', err));
  const applyOrderStock = new ApplyOrderStockUseCase(prisma);
  const orderEventsConsumer = new OrderEventsConsumer(redisClient, applyOrderStock);
  await orderEventsConsumer.start();

  const shutdown = async () => {
    orderEventsConsumer.stop();
    await redisClient.quit().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const FRONTEND_URLS = (process.env.FRONTEND_URLS || 'http://localhost:3000')
    .split(',')
    .map((u) => u.trim());

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: FRONTEND_URLS,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', service: 'product-service', port: PORT });
  });

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        const token = extractTokenFromAuthHeader(req.headers.authorization);
        let currentUser: TokenPayload | null = null;
        if (token) {
          try {
            currentUser = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
          } catch {
            currentUser = null;
          }
        }
        return { req, currentUser };
      },
    }),
  );

  app.listen(PORT, () => {
    console.log(`🚀 product-service running at http://localhost:${PORT}/graphql`);
  });
}

start().catch((err) => {
  console.error('Failed to start product-service:', err);
  process.exit(1);
});
