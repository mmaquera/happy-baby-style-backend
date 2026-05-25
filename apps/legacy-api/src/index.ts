import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createApolloServer } from './graphql/server';
import { Container } from '@shared/container';
import { LoggerFactory } from '@hbs/logging';
import { RequestLogger } from '@hbs/logging';
import { GraphQLPlayground } from '@infrastructure/web/GraphQLPlayground';
import { StaticFileMiddleware } from '@infrastructure/web/StaticFileMiddleware';
import { RateLimitMiddleware } from '@presentation/middleware/RateLimitMiddleware';
import { IRateLimitService } from '@domain/interfaces/IRateLimitService';
import { environment } from './config/environment';

const app: express.Express = express();
const config = environment.getConfig();
const PORT = config.port;

// Initialize container and logging
const container = Container.getInstance();
const logger = LoggerFactory.getInstance().getDefaultLogger();
const requestLogger = new RequestLogger();

// Log environment information
console.log('🚀 Starting Happy Baby Style Backend');
console.log('📊 Environment Info:', environment.getEnvironmentInfo());

// Middleware de seguridad y utilidades
if (config.enableHelmet) {
  app.use(helmet({
    contentSecurityPolicy: false, // Deshabilitar CSP para el playground
    crossOriginResourcePolicy: { policy: "cross-origin" } // Permitir acceso cross-origin para imágenes
  }));
}

if (config.enableCompression) {
  app.use(compression());
}

app.use(morgan('combined'));

// Request logging middleware
app.use(requestLogger.middleware());

// CORS configurado según el entorno
if (config.enableCors) {
  app.use(cors({
    origin: (origin, callback) => {
      const allowedOrigins = config.frontendUrls;
      
      // Permitir el frontend configurado (compatibilidad con configuración anterior)
      if (origin === config.frontendUrl) {
        callback(null, true);
      }
      // Permitir cualquier URL del array de URLs permitidas
      else if (origin && allowedOrigins.includes(origin)) {
        callback(null, true);
      }
      // Permitir aplicaciones móviles (sin origen)
      else if (!origin || origin === 'null') {
        callback(null, true);
      }
      else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  }));
}

// Rate Limiting Middleware - Critical for security
const rateLimitService = container.get<IRateLimitService>('rateLimitService');
const rateLimitMiddleware = new RateLimitMiddleware(rateLimitService, logger);

// Apply rate limiting to all routes only if enabled
if (config.enableRateLimit) {
  app.use(rateLimitMiddleware.createGeneralAPIMiddleware());
  console.log('🔒 Rate limiting enabled for general API');
} else {
  console.log('⚠️  Rate limiting disabled for development');
}

// Parseo de JSON (necesario para GraphQL)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Favicon para evitar errores 404
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Ruta de salud con información del entorno
app.get('/health', (req, res) => {
  logger.info('Health check requested', {
    endpoint: '/health',
    userAgent: req.get('User-Agent'),
    ip: req.ip
  }, (req as any).traceId);

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Happy Baby Style - GraphQL API',
    environment: config.nodeEnv,
    api: 'GraphQL Only',
    endpoint: '/graphql',
    playground: config.enableGraphQLPlayground ? 'Available at /playground' : 'Disabled in production',
    database: {
      host: environment.getDatabaseConfig().host,
      port: environment.getDatabaseConfig().port,
      name: environment.getDatabaseConfig().database,
      ssl: !!environment.getDatabaseConfig().ssl,
    },
    message: 'GraphQL API is the primary endpoint.'
  });
});

// Inicializar servidor
async function startServer() {
  try {
    logger.info('Starting Happy Baby Style GraphQL Server', {
      port: PORT,
      environment: config.nodeEnv,
      database: environment.getDatabaseConfig().host,
    });

    // Setup static file middleware for uploads (includes CORS headers)
    StaticFileMiddleware.setup(app);
    
    // Configurar Apollo GraphQL Server
    const apolloServer = await createApolloServer(app);
    
    // GraphQL Playground - Clean Architecture Implementation
    if (config.enableGraphQLPlayground) {
      app.get('/playground', (req, res) => {
        const playgroundHtml = GraphQLPlayground.generateInterface({
          title: 'GraphQL Playground - Happy Baby Style',
          endpoint: '/graphql',
          port: Number(PORT)
        });
        res.send(playgroundHtml);
      });
      
      logger.info('GraphQL Playground available at /playground', {
        playgroundUrl: `http://localhost:${PORT}/playground`,
        graphqlUrl: `http://localhost:${PORT}/graphql`
      });
    }
    
    // Middleware de manejo de errores
    app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error in request', error, {
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }, (req as any).traceId);

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });

    // Middleware para rutas no encontradas
    app.use('*', (req, res) => {
      logger.warn('404 - Endpoint not found', {
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }, (req as any).traceId);

      res.status(404).json({
        success: false,
        message: 'Endpoint not found. This API only supports GraphQL.',
        availableEndpoints: {
          graphql: '/graphql',
          health: '/health',
          playground: config.enableGraphQLPlayground ? '/graphql' : null
        },
        notice: 'Please use GraphQL endpoint at /graphql'
      });
    });
    
    // Iniciar servidor Express
    app.listen(PORT, () => {
      logger.info('🚀 Happy Baby Style GraphQL Server started successfully', {
        port: PORT,
        healthCheck: `http://localhost:${PORT}/health`,
        graphqlEndpoint: `http://localhost:${PORT}/graphql`,
        playground: config.enableGraphQLPlayground ? `http://localhost:${PORT}/graphql` : 'disabled',
        environment: config.nodeEnv,
        database: environment.getDatabaseConfig().host,
      });

                    console.log(`🚀 Happy Baby Style GraphQL Server running on port ${PORT}`);
              console.log(`📱 Health check: http://localhost:${PORT}/health`);
              console.log(`🎮 GraphQL Endpoint: http://localhost:${PORT}/graphql`);
              
              if (config.enableGraphQLPlayground) {
                console.log(`🔍 GraphQL Playground: http://localhost:${PORT}/playground`);
                console.log(`🎯 Apollo Studio: http://localhost:${PORT}/graphql`);
                console.log(`📊 Schema Explorer available in both interfaces`);
              }
      
      console.log(`✨ GraphQL API Ready`);
    });

    logger.info('✅ Apollo GraphQL Server initialized successfully');
  } catch (error) {
    logger.fatal('❌ Failed to start server', error as Error, {
      port: PORT,
      environment: config.nodeEnv,
      database: environment.getDatabaseConfig().host,
    });
    
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;