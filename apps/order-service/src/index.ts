import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { prisma } from '@hbs/prisma';
import { typeDefs } from './graphql/schema';
import { createResolvers } from './graphql/resolvers';
import { PrismaOrderRepository } from './infrastructure/repositories/PrismaOrderRepository';
import { HttpProductValidationAdapter } from './infrastructure/adapters/HttpProductValidationAdapter';
import { RedisEventPublisher } from './infrastructure/adapters/RedisEventPublisher';

dotenv.config();

const PORT = parseInt(process.env.ORDER_SERVICE_PORT || '3005', 10);
const FRONTEND_URLS = (process.env.FRONTEND_URLS || 'http://localhost:3000').split(',');
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003/graphql';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function start() {
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
    res.json({ status: 'OK', service: 'Order Service', port: PORT });
  });

  const redisClient = new Redis(REDIS_URL);
  redisClient.on('error', (err) => console.error('Redis error:', err));

  const orderRepository = new PrismaOrderRepository(prisma);
  const productValidation = new HttpProductValidationAdapter(PRODUCT_SERVICE_URL);
  const eventPublisher = new RedisEventPublisher(redisClient);

  const resolvers = createResolvers(orderRepository, productValidation, eventPublisher, prisma);

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
    console.log(`🚀 Order Service running at http://localhost:${PORT}/graphql`);
    console.log(`📦 Product validation via: ${PRODUCT_SERVICE_URL}`);
    console.log(`📢 Events → Redis: ${REDIS_URL}`);
  });
}

start().catch((err) => {
  console.error('Order Service failed to start:', err);
  process.exit(1);
});
