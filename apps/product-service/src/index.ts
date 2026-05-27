import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { prisma } from '@hbs/prisma';
import { typeDefs } from './graphql/schema';
import { createResolvers } from './graphql/resolvers';
import { PrismaProductRepository } from './infrastructure/repositories/PrismaProductRepository';

const PORT = parseInt(process.env.PRODUCT_SERVICE_PORT || '3003', 10);

async function start() {
  const productRepository = new PrismaProductRepository(prisma);
  const resolvers = createResolvers(productRepository, prisma);

  const schema = buildSubgraphSchema([{ typeDefs, resolvers: resolvers as any }]);
  const server = new ApolloServer({ schema, introspection: true });
  await server.start();

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', service: 'product-service', port: PORT });
  });

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => ({
        headers: req.headers,
        authHeader: req.headers.authorization,
      }),
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
