import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ILogger, LogLevel, LogContext } from '@domain/interfaces/ILogger';
import { LoggerConfigManager } from './LoggerConfig';
import { DomainError } from '@domain/errors/DomainError';

/**
 * Winston-based logger implementation
 * Implements the ILogger interface using Winston
 */
export class WinstonLogger implements ILogger {
  private logger: winston.Logger;
  private config: LoggerConfigManager;
  private traceId?: string;
  private childContext: Record<string, any> = {};

  constructor() {
    this.config = LoggerConfigManager.getInstance();
    this.logger = this.createWinstonLogger();
  }

  /**
   * Create Winston logger with configured transports
   */
  private createWinstonLogger(): winston.Logger {
    const config = this.config.getConfig();
    const transports: winston.transport[] = [];

    // Console transport
    if (config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: this.createConsoleFormat(),
          level: config.level
        })
      );
    }

    // File transport with daily rotation
    if (config.enableFile) {
      if (config.enableDailyRotate) {
        transports.push(
          new DailyRotateFile({
            filename: `${config.logDirectory}/application-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            maxSize: config.maxSize,
            maxFiles: config.maxFiles,
            format: this.createFileFormat(),
            level: config.level
          })
        );

        // Error log file
        transports.push(
          new DailyRotateFile({
            filename: `${config.logDirectory}/error-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            maxSize: config.maxSize,
            maxFiles: config.maxFiles,
            format: this.createFileFormat(),
            level: LogLevel.ERROR
          })
        );
      } else {
        transports.push(
          new winston.transports.File({
            filename: `${config.logDirectory}/application.log`,
            format: this.createFileFormat(),
            level: config.level
          })
        );

        transports.push(
          new winston.transports.File({
            filename: `${config.logDirectory}/error.log`,
            format: this.createFileFormat(),
            level: LogLevel.ERROR
          })
        );
      }
    }

    return winston.createLogger({
      level: config.level,
      transports,
      exitOnError: false
    });
  }

  /**
   * Create console format
   */
  private createConsoleFormat() {
    const config = this.config.getConfig();
    
    if (config.format === 'json') {
      return winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: config.enableErrorStack }),
        winston.format.json()
      );
    }

    return winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, context, error, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;
        
        if (context) {
          log += ` | Context: ${JSON.stringify(context)}`;
        }
        
        if (error && typeof error === 'object' && 'message' in error) {
          log += ` | Error: ${(error as any).message}`;
          if (config.enableErrorStack && (error as any).stack) {
            log += `\nStack: ${(error as any).stack}`;
          }
        }
        
        if (Object.keys(meta).length > 0) {
          log += ` | Meta: ${JSON.stringify(meta)}`;
        }
        
        return log;
      })
    );
  }

  /**
   * Create file format
   */
  private createFileFormat() {
    const config = this.config.getConfig();
    
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: config.enableErrorStack }),
      winston.format.json()
    );
  }

  /**
   * Create log context with trace ID and child context
   */
  private createLogContext(context?: Record<string, any>): LogContext {
    const logContext: LogContext = {
      ...this.childContext,
      ...context
    };

    if (this.traceId) {
      logContext.traceId = this.traceId;
    }

    return logContext;
  }

  /**
   * Format error for logging
   */
  private formatError(error?: Error): any {
    if (!error) return undefined;

    const errorInfo: any = {
      name: error.name,
      message: error.message
    };

    if (this.config.getConfig().enableErrorStack && error.stack) {
      errorInfo.stack = error.stack;
    }

    // Handle domain errors
    if (error instanceof DomainError) {
      errorInfo.code = error.code;
      errorInfo.statusCode = error.statusCode;
      errorInfo.details = error.details;
    }

    return errorInfo;
  }

  debug(message: string, context?: Record<string, any>, traceId?: string): void {
    const logContext = this.createLogContext(context);
    if (traceId) logContext.traceId = traceId;
    
    this.logger.debug(message, logContext);
  }

  info(message: string, context?: Record<string, any>, traceId?: string): void {
    const logContext = this.createLogContext(context);
    if (traceId) logContext.traceId = traceId;
    
    this.logger.info(message, logContext);
  }

  warn(message: string, context?: Record<string, any>, traceId?: string): void {
    const logContext = this.createLogContext(context);
    if (traceId) logContext.traceId = traceId;
    
    this.logger.warn(message, logContext);
  }

  error(message: string, error?: Error, context?: Record<string, any>, traceId?: string): void {
    const logContext = this.createLogContext(context);
    if (traceId) logContext.traceId = traceId;
    
    this.logger.error(message, {
      ...logContext,
      error: this.formatError(error)
    });
  }

  fatal(message: string, error?: Error, context?: Record<string, any>, traceId?: string): void {
    const logContext = this.createLogContext(context);
    if (traceId) logContext.traceId = traceId;
    
    this.logger.error(message, {
      ...logContext,
      error: this.formatError(error),
      level: 'fatal'
    });
  }

  child(context: Record<string, any>): ILogger {
    const childLogger = new WinstonLogger();
    childLogger.childContext = { ...this.childContext, ...context };
    childLogger.traceId = this.traceId;
    return childLogger;
  }

  setTraceId(traceId: string): ILogger {
    this.traceId = traceId;
    return this;
  }

  /**
   * Get the underlying Winston logger
   */
  getWinstonLogger(): winston.Logger {
    return this.logger;
  }

  /**
   * Close all transports
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.close();
      resolve();
    });
  }
} 