import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

class PrismaService {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
    if (!PrismaService.instance) {
      const isProd = process.env.NODE_ENV === 'production';
      const dbUrl = process.env.DATABASE_URL;

      if (isProd) {
        PrismaService.instance = new PrismaClient({
          log: ['error', 'warn'],
          datasources: { db: { url: dbUrl } },
        });
      } else {
        if (!global.__prisma) {
          global.__prisma = new PrismaClient({
            log: ['query', 'info', 'warn', 'error'],
            datasources: { db: { url: dbUrl } },
          });
        }
        PrismaService.instance = global.__prisma;
      }

      process.on('beforeExit', async () => {
        await PrismaService.instance.$disconnect();
      });

      process.on('SIGINT', async () => {
        await PrismaService.instance.$disconnect();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await PrismaService.instance.$disconnect();
      });
    }

    return PrismaService.instance;
  }

  public static async connect(): Promise<void> {
    await PrismaService.getInstance().$connect();
  }

  public static async disconnect(): Promise<void> {
    await PrismaService.getInstance().$disconnect();
  }

  public static async healthCheck(): Promise<boolean> {
    try {
      await PrismaService.getInstance().$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

export const prisma = PrismaService.getInstance();
export default PrismaService;
