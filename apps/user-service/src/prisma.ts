/**
 * User-service local Prisma singleton.
 *
 * This is the ONLY file in user-service that imports from './generated/prisma'.
 * All other modules import PrismaClient / Prisma types from here:
 *   import { prisma } from '../prisma'   (or relative depth as needed)
 *
 * Signal handlers (SIGINT/SIGTERM) and graceful shutdown are handled exclusively
 * by index.ts to ensure all resources (Redis, HTTP server, RBAC consumer) are
 * torn down in the correct order. This module intentionally registers NO signal
 * handlers — doing so here would fire before index.ts shutdown() and call
 * process.exit(0) prematurely, bypassing Redis.quit() and server.close().
 */

// Re-export PrismaClient constructor, Prisma namespace, and all generated model types
// so callers never need to touch './generated/prisma' directly.
export * from './generated/prisma';

import { PrismaClient } from './generated/prisma';

declare global {
  // eslint-disable-next-line no-var
  var __user_prisma: PrismaClient | undefined;
}

function buildPrismaClient(): PrismaClient {
  const isProd = process.env.NODE_ENV === 'production';
  const dbUrl = process.env.DATABASE_URL;

  if (isProd) {
    return new PrismaClient({
      log: ['error', 'warn'],
      datasources: { db: { url: dbUrl } },
    });
  }

  // In dev/test reuse the same instance across hot-reloads to avoid connection exhaustion.
  if (!global.__user_prisma) {
    global.__user_prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
      datasources: { db: { url: dbUrl } },
    });
  }
  return global.__user_prisma;
}

export const prisma: PrismaClient = buildPrismaClient();
