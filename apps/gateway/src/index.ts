import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.GATEWAY_PORT || '4000', 10);
const LEGACY_API_URL = process.env.LEGACY_API_URL || 'http://localhost:3001/graphql';
const CATEGORY_SERVICE_URL = process.env.CATEGORY_SERVICE_URL || 'http://localhost:3002/graphql';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003/graphql';
const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || 'http://localhost:3004/graphql';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3005/graphql';
const FRONTEND_URLS = (process.env.FRONTEND_URLS || 'http://localhost:3000').split(',');

// Forward the Authorization header from the client to every subgraph.
class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  willSendRequest({ request, context }: { request: any; context: any }) {
    if (context?.req?.headers?.authorization) {
      request.http?.headers.set('authorization', context.req.headers.authorization);
    }
  }
}

async function start() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false, // Apollo Sandbox needs this
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: FRONTEND_URLS,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', service: 'Apollo Federation Gateway', port: PORT });
  });

  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: [
        { name: 'legacy', url: LEGACY_API_URL },
        { name: 'category', url: CATEGORY_SERVICE_URL },
        { name: 'product', url: PRODUCT_SERVICE_URL },
        { name: 'media', url: MEDIA_SERVICE_URL },
        { name: 'order', url: ORDER_SERVICE_URL },
      ],
    }),
    buildService({ url }) {
      return new AuthenticatedDataSource({ url });
    },
  });

  const server = new ApolloServer({
    gateway,
    introspection: true,
  });

  await server.start();

  app.use(
    '/graphql',
    express.json({ limit: '10mb' }),
    expressMiddleware(server, {
      context: async ({ req }) => ({ req }),
    })
  );

  app.listen(PORT, () => {
    console.log(`🚀 Gateway running at http://localhost:${PORT}/graphql`);
    console.log(`📡 Composing subgraphs: legacy → ${LEGACY_API_URL} | category → ${CATEGORY_SERVICE_URL} | product → ${PRODUCT_SERVICE_URL} | media → ${MEDIA_SERVICE_URL} | order → ${ORDER_SERVICE_URL}`);
  });
}

start().catch((err) => {
  console.error('Gateway failed to start:', err);
  process.exit(1);
});
