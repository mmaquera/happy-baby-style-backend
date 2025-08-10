import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables with environment-aware precedence
// Precedence (lowest -> highest): .env -> .env.{env} -> .env.{env}.local -> .env.local
// This avoids surprising overrides and keeps local files highest priority
(() => {
  const cwd = process.cwd();
  const nodeEnv = process.env.NODE_ENV || 'development';

  const envFilesInOrder: string[] = [
    path.join(cwd, '.env'),
    path.join(cwd, `.env.${nodeEnv}`),
    path.join(cwd, `.env.${nodeEnv}.local`),
    path.join(cwd, '.env.local'),
  ];

  // Load base .env without override, then allow env-specific and local to override
  envFilesInOrder.forEach((filePath, index) => {
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath, override: index > 0 });
    }
  });
})();

export interface EnvironmentConfig {
  // Server Configuration
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  
  // Database Configuration
  databaseUrl: string;
  databaseHost: string;
  databasePort: number;
  databaseName: string;
  databaseUser: string;
  databasePassword: string;
  databaseSsl: boolean;
  
  // JWT Configuration
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  
  // OAuth Configuration
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  oauthStateSecret: string;
  sessionSecret: string;
  
  // File Upload Configuration
  maxFileSize: number;
  uploadPath: string;
  
  // Logging Configuration
  logLevel: string;
  logEnableConsole: boolean;
  logEnableFile: boolean;
  logEnableDailyRotate: boolean;
  logDirectory: string;
  logMaxFiles: string;
  logMaxSize: string;
  logFormat: string;
  logIncludeTimestamp: boolean;
  logIncludeTraceId: boolean;
  logIncludeRequestId: boolean;
  logIncludeUserId: boolean;
  logEnableErrorStack: boolean;
  logEnablePerformance: boolean;
  
  // Feature Flags
  enableGraphQLPlayground: boolean;
  enableCors: boolean;
  enableCompression: boolean;
  enableHelmet: boolean;
}

class EnvironmentService {
  private static instance: EnvironmentService;
  private config: EnvironmentConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): EnvironmentService {
    if (!EnvironmentService.instance) {
      EnvironmentService.instance = new EnvironmentService();
    }
    return EnvironmentService.instance;
  }

  private loadConfiguration(): EnvironmentConfig {
    const isProduction = process.env.NODE_ENV === 'production';

    // Resolve database configuration from either DATABASE_URL or DB_* vars
    const rawDatabaseUrl = (process.env.DATABASE_URL || '').trim();
    const dbHostVar = (process.env.DB_HOST || '').trim();
    const dbPortVar = parseInt((process.env.DB_PORT || '5432').toString(), 10);
    const dbNameVar = (process.env.DB_NAME || '').trim();
    const dbUserVar = (process.env.DB_USER || '').trim();
    const dbPasswordVar = (process.env.DB_PASSWORD || '').trim();
    const dbSslVar = (process.env.DB_SSL || '').toLowerCase() === 'true';

    // Helper: derive host/name/port/ssl from DATABASE_URL if present
    const deriveFromUrl = (url: string) => {
      try {
        const parsed = new URL(url);
        const host = parsed.hostname || '';
        const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
        // pathname like "/db_name"
        const name = (parsed.pathname || '').replace(/^\//, '') || '';
        const sslMode = parsed.searchParams.get('sslmode');
        const ssl = sslMode === 'require' || sslMode === 'prefer' || sslMode === 'verify-full' || dbSslVar;
        return { host, port, name, ssl };
      } catch {
        return { host: '', port: dbPortVar, name: '', ssl: dbSslVar };
      }
    };

    const urlDerived = rawDatabaseUrl ? deriveFromUrl(rawDatabaseUrl) : null;

    // Fail-fast validation: require either DATABASE_URL or full DB_* set
    const hasDatabaseUrl = !!rawDatabaseUrl;
    const hasDbPieces = !!(dbHostVar && dbNameVar && dbUserVar && dbPasswordVar);
    if (!hasDatabaseUrl && !hasDbPieces) {
      // Throwing here makes misconfiguration obvious at startup
      throw new Error(
        'Database configuration missing. Provide DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.'
      );
    }

    return {
      // Server Configuration
      port: parseInt(process.env.PORT || '3001'),
      nodeEnv: process.env.NODE_ENV || 'development',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      
      // Database Configuration
      databaseUrl: rawDatabaseUrl,
      databaseHost: urlDerived?.host || dbHostVar,
      databasePort: urlDerived?.port ?? dbPortVar,
      databaseName: urlDerived?.name || dbNameVar,
      databaseUser: dbUserVar,
      databasePassword: dbPasswordVar,
      databaseSsl: urlDerived?.ssl ?? dbSslVar,
      
      // JWT Configuration
      jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
      jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      
      // OAuth Configuration
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback',
      oauthStateSecret: process.env.OAUTH_STATE_SECRET || 'your-oauth-state-secret-here',
      sessionSecret: process.env.SESSION_SECRET || 'your-session-secret-here',
      
      // File Upload Configuration
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
      uploadPath: process.env.UPLOAD_PATH || './uploads',
      
      // Logging Configuration
      logLevel: process.env.LOG_LEVEL || 'info',
      logEnableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
      logEnableFile: process.env.LOG_ENABLE_FILE !== 'false',
      logEnableDailyRotate: process.env.LOG_ENABLE_DAILY_ROTATE !== 'false',
      logDirectory: process.env.LOG_DIRECTORY || './logs',
      logMaxFiles: process.env.LOG_MAX_FILES || '14d',
      logMaxSize: process.env.LOG_MAX_SIZE || '20m',
      logFormat: process.env.LOG_FORMAT || 'json',
      logIncludeTimestamp: process.env.LOG_INCLUDE_TIMESTAMP !== 'false',
      logIncludeTraceId: process.env.LOG_INCLUDE_TRACE_ID !== 'false',
      logIncludeRequestId: process.env.LOG_INCLUDE_REQUEST_ID !== 'false',
      logIncludeUserId: process.env.LOG_INCLUDE_USER_ID !== 'false',
      logEnableErrorStack: process.env.LOG_ENABLE_ERROR_STACK !== 'false',
      logEnablePerformance: process.env.LOG_ENABLE_PERFORMANCE !== 'false',
      
      // Feature Flags
      enableGraphQLPlayground: !isProduction,
      enableCors: true,
      enableCompression: true,
      enableHelmet: true,
    };
  }

  public getConfig(): EnvironmentConfig {
    return this.config;
  }

  public getDatabaseConfig() {
    const { databaseUrl, databaseHost, databasePort, databaseName, databaseUser, databasePassword, databaseSsl } = this.config;
    
    return {
      url: databaseUrl,
      host: databaseHost,
      port: databasePort,
      database: databaseName,
      user: databaseUser,
      password: databasePassword,
      ssl: databaseSsl ? { rejectUnauthorized: false } : false,
    };
  }

  public isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  public isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  public isTest(): boolean {
    return this.config.nodeEnv === 'test';
  }

  public getEnvironmentInfo() {
    return {
      environment: this.config.nodeEnv,
      port: this.config.port,
      database: {
        host: this.config.databaseHost,
        port: this.config.databasePort,
        name: this.config.databaseName,
        ssl: this.config.databaseSsl,
      },
      features: {
        graphqlPlayground: this.config.enableGraphQLPlayground,
        cors: this.config.enableCors,
        compression: this.config.enableCompression,
        helmet: this.config.enableHelmet,
      },
    };
  }
}

export const environment = EnvironmentService.getInstance();
export default EnvironmentService; 