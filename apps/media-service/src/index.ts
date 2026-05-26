import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { graphqlUploadExpress } from 'graphql-upload-cjs';
import dotenv from 'dotenv';
import { prisma } from '@hbs/prisma';
import { typeDefs } from './graphql/schema';
import { createResolvers } from './graphql/resolvers';
import { PrismaImageRepository } from './infrastructure/repositories/PrismaImageRepository';
import { PrismaSvgRepository } from './infrastructure/repositories/PrismaSvgRepository';
import { LocalStorageService } from './infrastructure/services/LocalStorageService';

dotenv.config();

const PORT = parseInt(process.env.MEDIA_SERVICE_PORT || '3004', 10);
const FRONTEND_URLS = (process.env.FRONTEND_URLS || 'http://localhost:3000').split(',');

async function start() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  );

  app.use(
    cors({
      origin: FRONTEND_URLS,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', service: 'Media Service', port: PORT });
  });

  const imageRepository = new PrismaImageRepository(prisma);
  const svgRepository = new PrismaSvgRepository(prisma);
  const storageService = new LocalStorageService();

  const resolvers = createResolvers(imageRepository, svgRepository, storageService);

  const server = new ApolloServer({
    schema: buildSubgraphSchema([{ typeDefs, resolvers: resolvers as any }]),
    introspection: true
  });

  await server.start();

  app.use(
    '/graphql',
    graphqlUploadExpress({ maxFileSize: 10 * 1024 * 1024, maxFiles: 10 }),
    express.json({ limit: '10mb' }),
    expressMiddleware(server, {
      context: async ({ req }) => ({ req })
    })
  );

  app.listen(PORT, () => {
    console.log(`🚀 Media Service running at http://localhost:${PORT}/graphql`);
  });
}

start().catch((err) => {
  console.error('Media Service failed to start:', err);
  process.exit(1);
});
