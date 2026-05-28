import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.GATEWAY_PORT || '4000', 10);

const toGqlError = (message: string) => ({
  errors: [{ message, extensions: { code: 'RATE_LIMIT_EXCEEDED' } }],
});

// 300 requests per 15 minutes per IP — general protection
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GENERAL || '300', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(toGqlError('Too many requests, please slow down'));
  },
});

// 10 requests per 15 minutes per IP — for sensitive auth mutations
const AUTH_MUTATIONS = [
  'loginUser',
  'createUser',
  'generatePasswordResetToken',
  'resetPasswordWithToken',
  'updateUserPassword',
];

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const query: string = req.body?.query ?? '';
    return !AUTH_MUTATIONS.some((op) => query.includes(op));
  },
  handler: (_req, res) => {
    res.status(429).json(toGqlError('Too many authentication attempts, please try again later'));
  },
});

const CATEGORY_SERVICE_URL = process.env.CATEGORY_SERVICE_URL || 'http://localhost:3002/graphql';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003/graphql';
const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || 'http://localhost:3004/graphql';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3005/graphql';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3006/graphql';
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
    res.json({ status: 'OK', service: 'Apollo Federation Gateway', port: PORT });
  });

  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: [
        { name: 'category', url: CATEGORY_SERVICE_URL },
        { name: 'product', url: PRODUCT_SERVICE_URL },
        { name: 'media', url: MEDIA_SERVICE_URL },
        { name: 'order', url: ORDER_SERVICE_URL },
        { name: 'user', url: USER_SERVICE_URL },
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
    generalLimiter,
    express.json({ limit: '10mb' }),
    authLimiter,
    expressMiddleware(server, {
      context: async ({ req }) => ({ req }),
    }),
  );

  app.listen(PORT, () => {
    console.log(`🚀 Gateway running at http://localhost:${PORT}/graphql`);
    console.log(
      `📡 Composing subgraphs: category → ${CATEGORY_SERVICE_URL} | product → ${PRODUCT_SERVICE_URL} | media → ${MEDIA_SERVICE_URL} | order → ${ORDER_SERVICE_URL} | user → ${USER_SERVICE_URL}`,
    );
  });
}

start().catch((err) => {
  console.error('Gateway failed to start:', err);
  process.exit(1);
});
