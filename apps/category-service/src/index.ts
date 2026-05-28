import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import dotenv from 'dotenv';
import { prisma } from '@hbs/prisma';
import { extractTokenFromAuthHeader } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';
import { RequestLogger } from '@hbs/logging';
import { PrismaCategoryRepository } from './infrastructure/repositories/PrismaCategoryRepository';
import { typeDefs } from './graphql/schema';
import { createResolvers } from './graphql/resolvers';

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start.');
  process.exit(1);
}

const PORT = parseInt(process.env.CATEGORY_SERVICE_PORT || '3002', 10);
const FRONTEND_URLS = (process.env.FRONTEND_URLS || 'http://localhost:3000')
  .split(',')
  .map((u) => u.trim());

async function start() {
  const categoryRepository = new PrismaCategoryRepository(prisma);
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
    console.log(`🚀 category-service running at http://localhost:${PORT}/graphql`);
  });
}

process.on('SIGINT', () => {
  prisma.$disconnect().then(() => process.exit(0));
});
process.on('SIGTERM', () => {
  prisma.$disconnect().then(() => process.exit(0));
});

start().catch((err) => {
  console.error('category-service failed to start:', err);
  process.exit(1);
});
