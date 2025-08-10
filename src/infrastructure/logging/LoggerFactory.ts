import { ILogger } from '@domain/interfaces/ILogger';
import { WinstonLogger } from './WinstonLogger';
import { LoggerConfigManager } from './LoggerConfig';

/**
 * Logger factory for creating logger instances
 * Follows the Factory pattern for logger creation
 */
export class LoggerFactory {
  private static instance: LoggerFactory;
  private defaultLogger: ILogger;

  private constructor() {
    this.defaultLogger = new WinstonLogger();
  }

  /**
   * Get singleton instance of LoggerFactory
   */
  static getInstance(): LoggerFactory {
    if (!this.instance) {
      this.instance = new LoggerFactory();
    }
    return this.instance;
  }

  /**
   * Static method to create a logger with specific module name
   * This is the method being called in the use cases
   */
  static create(moduleName: string): ILogger {
    return this.getInstance().createModuleLogger(moduleName);
  }

  /**
   * Create a new logger instance
   */
  createLogger(): ILogger {
    return new WinstonLogger();
  }

  /**
   * Create a logger with specific context
   */
  createLoggerWithContext(context: Record<string, any>): ILogger {
    return new WinstonLogger().child(context);
  }

  /**
   * Create a logger for a specific module
   */
  createModuleLogger(moduleName: string): ILogger {
    return this.createLoggerWithContext({ module: moduleName });
  }

  /**
   * Create a logger for a specific service
   */
  createServiceLogger(serviceName: string): ILogger {
    return this.createLoggerWithContext({ service: serviceName });
  }

  /**
   * Create a logger for a specific use case
   */
  createUseCaseLogger(useCaseName: string): ILogger {
    return this.createLoggerWithContext({ useCase: useCaseName });
  }

  /**
   * Create a logger for a specific repository
   */
  createRepositoryLogger(repositoryName: string): ILogger {
    return this.createLoggerWithContext({ repository: repositoryName });
  }

  /**
   * Create a logger for GraphQL operations
   */
  createGraphQLLogger(): ILogger {
    return this.createLoggerWithContext({ 
      module: 'GraphQL',
      operation: 'query'
    });
  }

  /**
   * Create a logger for HTTP requests
   */
  createRequestLogger(): ILogger {
    return this.createLoggerWithContext({ 
      module: 'HTTP',
      operation: 'request'
    });
  }

  /**
   * Create a logger for database operations
   */
  createDatabaseLogger(): ILogger {
    return this.createLoggerWithContext({ 
      module: 'Database',
      operation: 'query'
    });
  }

  /**
   * Create a logger for authentication operations
   */
  createAuthLogger(): ILogger {
    return this.createLoggerWithContext({ 
      module: 'Authentication',
      operation: 'auth'
    });
  }

  /**
   * Create a logger for validation operations
   */
  createValidationLogger(): ILogger {
    return this.createLoggerWithContext({ 
      module: 'Validation',
      operation: 'validate'
    });
  }

  /**
   * Get the default logger instance
   */
  getDefaultLogger(): ILogger {
    return this.defaultLogger;
  }

  /**
   * Create a performance logger
   */
  createPerformanceLogger(): ILogger {
    const config = LoggerConfigManager.getInstance().getConfig();
    if (!config.enablePerformanceLogging) {
      // Return a no-op logger if performance logging is disabled
      return this.createNoOpLogger();
    }
    
    return this.createLoggerWithContext({ 
      module: 'Performance',
      operation: 'measure'
    });
  }

  /**
   * Create a no-op logger for when logging is disabled
   */
  private createNoOpLogger(): ILogger {
    return {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      fatal: () => {},
      child: () => this.createNoOpLogger(),
      setTraceId: () => this.createNoOpLogger()
    };
  }

  /**
   * Close all logger instances
   */
  async closeAllLoggers(): Promise<void> {
    if (this.defaultLogger instanceof WinstonLogger) {
      await this.defaultLogger.close();
    }
  }
} 