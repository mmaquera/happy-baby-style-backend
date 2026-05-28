import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { prisma } from '@hbs/prisma';
import { extractTokenFromAuthHeader } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';
import { RequestLogger } from '@hbs/logging';
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

const PORT = parseInt(process.env.ORDER_SERVICE_PORT || '3005', 10);
const FRONTEND_URLS = (process.env.FRONTEND_URLS || 'http://localhost:3000').split(',');
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003/graphql';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function start() {
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
  redisClient.on('error', (err) => console.error('Redis error:', err));

  const orderRepository = new PrismaOrderRepository(prisma);
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
    console.log(`🚀 Order Service running at http://localhost:${PORT}/graphql`);
    console.log(`📦 Product validation via: ${PRODUCT_SERVICE_URL}`);
    console.log(`📢 Events → Redis: ${REDIS_URL}`);
  });
}

start().catch((err) => {
  console.error('Order Service failed to start:', err);
  process.exit(1);
});
