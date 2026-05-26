import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import dotenv from 'dotenv';
import { prisma } from '@hbs/prisma';
import { PrismaCategoryRepository } from './infrastructure/repositories/PrismaCategoryRepository';
import { typeDefs } from './graphql/schema';
import { createResolvers } from './graphql/resolvers';

dotenv.config();

const PORT = parseInt(process.env.CATEGORY_SERVICE_PORT || '3002', 10);
const FRONTEND_URLS = (process.env.FRONTEND_URLS || 'http://localhost:3000').split(',').map(u => u.trim());

async function start() {
  const categoryRepository = new PrismaCategoryRepository(prisma);
  const resolvers = createResolvers(categoryRepository);

  const schema = buildSubgraphSchema([{ typeDefs, resolvers: resolvers as any }]);
  const server = new ApolloServer({ schema, introspection: true });
  await server.start();

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: FRONTEND_URLS, credentials: true, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', service: 'category-service', port: PORT });
  });

  app.use(
    '/graphql',
    express.json({ limit: '2mb' }),
    expressMiddleware(server, { context: async ({ req }) => ({ req }) })
  );

  app.listen(PORT, () => {
    console.log(`🚀 category-service running at http://localhost:${PORT}/graphql`);
  });
}

process.on('SIGINT', () => { prisma.$disconnect().then(() => process.exit(0)); });
process.on('SIGTERM', () => { prisma.$disconnect().then(() => process.exit(0)); });

start().catch(err => { console.error('category-service failed to start:', err); process.exit(1); });
