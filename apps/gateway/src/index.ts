import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import dotenv from 'dotenv';
import { LoggerFactory, RequestLogger } from '@hbs/logging';

dotenv.config();

const PORT = parseInt(process.env.GATEWAY_PORT || '4000', 10);
const logger = LoggerFactory.getInstance().createServiceLogger('gateway');

// ── Trust proxy ─────────────────────────────────────────────────────────────
// SECURITY: Controls how Express reads the client IP from X-Forwarded-For.
// - false (default)  → use socket IP; safe for direct exposure, no spoofing risk.
// - 'loopback'       → trust only 127.0.0.1 / ::1 as proxy; safe for docker-compose.
// - 1                → trust exactly 1 hop (e.g. a single nginx/ALB in front).
// - true             → trust ALL X-Forwarded-For entries; NEVER use in production
//                      — allows any client to spoof their IP and bypass rate limiting.
//
// In docker-compose the gateway sits behind no external proxy, so 'loopback' is
// the correct safe default. In a cloud deployment with one ALB/nginx: set TRUST_PROXY=1.
// See: https://expressjs.com/en/guide/behind-proxies.html
const TRUST_PROXY: string | number | boolean = (() => {
  const raw = process.env.TRUST_PROXY;
  if (!raw) return 'loopback';
  if (raw === 'true') {
    logger.warn(
      'TRUST_PROXY=true allows X-Forwarded-For spoofing — rate limiting becomes bypassable. Use a numeric hop count instead.',
      {},
    );
    return true;
  }
  if (raw === 'false') return false;
  const n = parseInt(raw, 10);
  return isNaN(n) ? raw : n;
})();

// ── Redis client for distributed rate limiting ───────────────────────────────
// Degradation strategy: if Redis is unavailable, limiters fall back to in-memory
// counters (no store). Counters reset on restart but the gateway keeps running.
let redisClient: Redis | null = null;
let generalStore: RedisStore | undefined;
let authStore: RedisStore | undefined;

if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    // Fail fast on connection errors — do not block gateway startup.
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  redisClient.on('error', (err: Error) => {
    logger.error('Redis rate-limit store error — falling back to in-memory counters', err, {
      service: 'gateway',
    });
  });

  redisClient.on('connect', () => {
    logger.info('Redis rate-limit store connected', { service: 'gateway' });
  });

  // Attempt a non-blocking connect; if it fails, stores stay undefined (in-memory).
  redisClient.connect().catch((err: Error) => {
    logger.warn(
      'Redis unavailable at startup — rate limiters will use in-memory fallback until Redis recovers',
      { service: 'gateway', error: err.message },
    );
  });

  // RedisStore requires a sendCommand function that wraps the ioredis client.
  const sendCommand = (...args: string[]) =>
    (redisClient as Redis).call(args[0], ...args.slice(1)) as Promise<any>;

  generalStore = new RedisStore({ prefix: 'rl:general:', sendCommand });
  authStore = new RedisStore({ prefix: 'rl:auth:', sendCommand });
} else {
  logger.warn(
    'REDIS_URL not set — rate limiters will use in-memory stores (not distributed)',
    { service: 'gateway' },
  );
}

const toGqlError = (message: string) => ({
  errors: [{ message, extensions: { code: 'RATE_LIMIT_EXCEEDED' } }],
});

// 300 requests per 15 minutes per IP — general protection
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GENERAL || '300', 10),
  standardHeaders: true,
  legacyHeaders: false,
  // store is undefined when Redis is unavailable → express-rate-limit uses in-memory
  ...(generalStore ? { store: generalStore } : {}),
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
  'requestEmailVerification',
  'resendVerificationEmail',
  'verifyEmail',
  'verifyTotp',
  'enableMFA',
  'verifyMFASetup',
  'disableMFA',
];

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  // store is undefined when Redis is unavailable → express-rate-limit uses in-memory
  ...(authStore ? { store: authStore } : {}),
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
  const requestLogger = new RequestLogger();

  // Trust proxy: must be set before any middleware that reads req.ip.
  // Controls X-Forwarded-For trust. See TRUST_PROXY constant above for values.
  app.set('trust proxy', TRUST_PROXY);

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
  app.use(requestLogger.middleware());

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
      // Re-introspect all subgraphs every 10s so schema changes propagate
      // automatically without a gateway restart. Each poll makes 5 lightweight
      // introspection requests (one per subgraph) — negligible overhead.
      pollIntervalInMs: 10_000,
    }),
    buildService({ url }) {
      return new AuthenticatedDataSource({ url });
    },
  });

  const server = new ApolloServer({
    gateway,
    introspection: process.env.NODE_ENV !== 'production',
    includeStacktraceInErrorResponses: process.env.NODE_ENV === 'development',
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
    logger.info(`Gateway running at http://localhost:${PORT}/graphql`, { service: 'gateway' });
    logger.info(
      `Composing subgraphs: category=${CATEGORY_SERVICE_URL} product=${PRODUCT_SERVICE_URL} media=${MEDIA_SERVICE_URL} order=${ORDER_SERVICE_URL} user=${USER_SERVICE_URL}`,
      { service: 'gateway' },
    );
  });
}

start().catch((err) => {
  logger.error('Gateway failed to start', err as Error, { service: 'gateway' });
  process.exit(1);
});
