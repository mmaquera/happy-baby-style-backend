/**
 * Product-service local Prisma singleton.
 *
 * This is the ONLY file in product-service that imports from './generated/prisma'.
 * All other modules import PrismaClient / Prisma types from here.
 *
 * Signal handlers are intentionally NOT registered here — see user-service/src/prisma.ts
 * for rationale. Shutdown is orchestrated exclusively by index.ts.
 */

export * from './generated/prisma';

import { PrismaClient } from './generated/prisma';

declare global {
  // eslint-disable-next-line no-var
  var __product_prisma: PrismaClient | undefined;
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

  if (!global.__product_prisma) {
    global.__product_prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
      datasources: { db: { url: dbUrl } },
    });
  }
  return global.__product_prisma;
}

export const prisma: PrismaClient = buildPrismaClient();
