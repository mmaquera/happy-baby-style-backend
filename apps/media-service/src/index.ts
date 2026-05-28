import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as path from 'path';
import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { graphqlUploadExpress } from 'graphql-upload-cjs';
import dotenv from 'dotenv';
import { prisma } from '@hbs/prisma';
import { extractTokenFromAuthHeader } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';
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

const PORT = parseInt(process.env.MEDIA_SERVICE_PORT || '3004', 10);
const FRONTEND_URLS = (process.env.FRONTEND_URLS || 'http://localhost:3000').split(',');

async function start() {
  const app = express();

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
    plugins: [authPlugin],
  });

  await server.start();

  app.use(
    '/graphql',
    graphqlUploadExpress({ maxFileSize: 10 * 1024 * 1024, maxFiles: 10 }),
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
    console.log(`🚀 Media Service running at http://localhost:${PORT}/graphql`);
  });
}

start().catch((err) => {
  console.error('Media Service failed to start:', err);
  process.exit(1);
});
