import { PrismaClient } from '@prisma/client';
import { environment } from '../../config/environment';

declare global {
  var __prisma: PrismaClient | undefined;
}

class PrismaService {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
    if (!PrismaService.instance) {
      const config = environment.getConfig();
      
      if (config.nodeEnv === 'production') {
        PrismaService.instance = new PrismaClient({
          log: ['error', 'warn'],
          datasources: {
            db: {
              url: config.databaseUrl,
            },
          },
        });
      } else {
        // En desarrollo, usar global para evitar múltiples conexiones con hot reload
        if (!global.__prisma) {
          global.__prisma = new PrismaClient({
            log: ['query', 'info', 'warn', 'error'],
            datasources: {
              db: {
                url: config.databaseUrl,
              },
            },
          });
        }
        PrismaService.instance = global.__prisma;
      }

      // Log de configuración
      console.log('🗄️ Prisma Configuration:', {
        environment: config.nodeEnv,
        database: environment.getDatabaseConfig().host,
        playground: config.enableGraphQLPlayground,
      });

      // Manejo de errores de desconexión
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
    const client = PrismaService.getInstance();
    await client.$connect();
  }

  public static async disconnect(): Promise<void> {
    const client = PrismaService.getInstance();
    await client.$disconnect();
  }

  public static async healthCheck(): Promise<boolean> {
    try {
      const client = PrismaService.getInstance();
      await client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Prisma health check failed:', error);
      return false;
    }
  }

  public static getEnvironmentInfo() {
    const config = environment.getConfig();
    return {
      environment: config.nodeEnv,
      database: {
        host: environment.getDatabaseConfig().host,
        port: environment.getDatabaseConfig().port,
        name: environment.getDatabaseConfig().database,
        ssl: environment.getDatabaseConfig().ssl,
      },
      features: {
        graphqlPlayground: config.enableGraphQLPlayground,
        logging: config.logLevel,
      },
    };
  }
}

// Singleton export
export const prisma = PrismaService.getInstance();
export default PrismaService;