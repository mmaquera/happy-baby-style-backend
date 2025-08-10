import { ILogger } from '@domain/interfaces/ILogger';
import { LoggerFactory } from './LoggerFactory';
import { PerformanceLogger } from './PerformanceLogger';

/**
 * Logging decorator options
 */
export interface LoggingOptions {
  level?: 'debug' | 'info' | 'warn' | 'error';
  includeArgs?: boolean;
  includeResult?: boolean;
  includeDuration?: boolean;
  includeError?: boolean;
  context?: Record<string, any>;
  operationName?: string;
}

/**
 * Logging decorator for automatic logging of method calls
 * Provides automatic logging with performance measurement
 */
export class LoggingDecorator {
  private static logger: ILogger;
  private static performanceLogger: PerformanceLogger;

  /**
   * Initialize logging decorator
   */
  static initialize(): void {
    this.logger = LoggerFactory.getInstance().getDefaultLogger();
    this.performanceLogger = new PerformanceLogger();
  }

  /**
   * Decorator for logging method calls
   */
  static log(options: LoggingOptions = {}) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const method = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const operationName = options.operationName || `${target.constructor.name}.${propertyName}`;
        const startTime = Date.now();
        const traceId = (this as any).generateTraceId?.() || `trace_${Date.now()}`;

        // Log method entry
        const entryContext: any = {
          operation: operationName,
          method: propertyName,
          className: target.constructor.name,
          ...options.context
        };

        if (options.includeArgs && args.length > 0) {
          entryContext.args = LoggingDecorator.sanitizeArgs(args);
        }

        LoggingDecorator.logger.debug(`Entering ${operationName}`, entryContext, traceId);

        try {
          // Execute method
          const result = await method.apply(this, args);
          const duration = Date.now() - startTime;

          // Log successful completion
          const successContext: any = {
            ...entryContext,
            duration,
            success: true
          };

          if (options.includeResult && result !== undefined) {
            successContext.result = LoggingDecorator.sanitizeResult(result);
          }

          if (options.includeDuration && duration > 1000) {
            LoggingDecorator.logger.warn(`Slow operation: ${operationName} took ${duration}ms`, successContext, traceId);
          } else {
            LoggingDecorator.logger.debug(`Completed ${operationName}`, successContext, traceId);
          }

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorContext = {
            ...entryContext,
            duration,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };

          if (options.includeError) {
            LoggingDecorator.logger.error(`Error in ${operationName}`, error as Error, errorContext, traceId);
          } else {
            LoggingDecorator.logger.warn(`Failed ${operationName}`, errorContext, traceId);
          }

          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * Decorator for logging use cases with performance measurement
   */
  static logUseCase(options: LoggingOptions = {}) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const method = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const operationName = options.operationName || `${target.constructor.name}.${propertyName}`;
        const useCaseLogger = LoggerFactory.getInstance().createUseCaseLogger(operationName);
        const traceId = (this as any).generateTraceId?.() || `trace_${Date.now()}`;

        // Start performance measurement
        const operationId = LoggingDecorator.performanceLogger.startTimer(operationName, {
          useCase: operationName,
          args: options.includeArgs ? LoggingDecorator.sanitizeArgs(args) : undefined
        });

        try {
          // Log use case start
          useCaseLogger.info(`Starting use case: ${operationName}`, {
            operation: operationName,
            args: options.includeArgs ? LoggingDecorator.sanitizeArgs(args) : undefined,
            ...options.context
          }, traceId);

          // Execute use case
          const result = await method.apply(this, args);

          // End performance measurement
          const measurement = LoggingDecorator.performanceLogger.endTimer(operationId, {
            success: true,
            result: options.includeResult ? LoggingDecorator.sanitizeResult(result) : undefined
          });

          // Log successful completion
          useCaseLogger.info(`Use case completed: ${operationName}`, {
            operation: operationName,
            duration: measurement?.duration,
            success: true,
            result: options.includeResult ? LoggingDecorator.sanitizeResult(result) : undefined,
            ...options.context
          }, traceId);

          return result;
        } catch (error) {
          // End performance measurement with error
          LoggingDecorator.performanceLogger.endTimer(operationId, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });

          // Log error
          useCaseLogger.error(`Use case failed: ${operationName}`, error as Error, {
            operation: operationName,
            success: false,
            ...options.context
          }, traceId);

          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * Decorator for logging repository operations
   */
  static logRepository(options: LoggingOptions = {}) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const method = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const operationName = options.operationName || `${target.constructor.name}.${propertyName}`;
        const repositoryLogger = LoggerFactory.getInstance().createRepositoryLogger(operationName);
        const traceId = (this as any).generateTraceId?.() || `trace_${Date.now()}`;

        const startTime = Date.now();

        try {
          // Log repository operation start
          repositoryLogger.debug(`Repository operation: ${operationName}`, {
            operation: operationName,
            method: propertyName,
            repository: target.constructor.name,
            args: options.includeArgs ? LoggingDecorator.sanitizeArgs(args) : undefined,
            ...options.context
          }, traceId);

          // Execute repository operation
          const result = await method.apply(this, args);
          const duration = Date.now() - startTime;

          // Log successful completion
          repositoryLogger.debug(`Repository operation completed: ${operationName}`, {
            operation: operationName,
            duration,
            success: true,
            result: options.includeResult ? LoggingDecorator.sanitizeResult(result) : undefined,
            ...options.context
          }, traceId);

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;

          // Log error
          repositoryLogger.error(`Repository operation failed: ${operationName}`, error as Error, {
            operation: operationName,
            duration,
            success: false,
            ...options.context
          }, traceId);

          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * Decorator for logging service operations
   */
  static logService(options: LoggingOptions = {}) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const method = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const operationName = options.operationName || `${target.constructor.name}.${propertyName}`;
        const serviceLogger = LoggerFactory.getInstance().createServiceLogger(operationName);
        const traceId = (this as any).generateTraceId?.() || `trace_${Date.now()}`;

        const startTime = Date.now();

        try {
          // Log service operation start
          serviceLogger.debug(`Service operation: ${operationName}`, {
            operation: operationName,
            method: propertyName,
            service: target.constructor.name,
            args: options.includeArgs ? LoggingDecorator.sanitizeArgs(args) : undefined,
            ...options.context
          }, traceId);

          // Execute service operation
          const result = await method.apply(this, args);
          const duration = Date.now() - startTime;

          // Log successful completion
          serviceLogger.debug(`Service operation completed: ${operationName}`, {
            operation: operationName,
            duration,
            success: true,
            result: options.includeResult ? LoggingDecorator.sanitizeResult(result) : undefined,
            ...options.context
          }, traceId);

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;

          // Log error
          serviceLogger.error(`Service operation failed: ${operationName}`, error as Error, {
            operation: operationName,
            duration,
            success: false,
            ...options.context
          }, traceId);

          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * Sanitize arguments for logging
   */
  private static sanitizeArgs(args: any[]): any[] {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        const sanitized = { ...arg };
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];

        sensitiveFields.forEach(field => {
          if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
          }
        });

        return sanitized;
      }
      return arg;
    });
  }

  /**
   * Sanitize result for logging
   */
  private static sanitizeResult(result: any): any {
    if (typeof result === 'object' && result !== null) {
      const sanitized = { ...result };
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];

      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });

      return sanitized;
    }
    return result;
  }
} 