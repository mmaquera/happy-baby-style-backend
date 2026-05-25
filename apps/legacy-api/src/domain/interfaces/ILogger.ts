/**
 * Domain interface for logging functionality
 * This interface defines the contract for logging operations
 * following Clean Architecture principles
 */
export interface ILogger {
  /**
   * Log a debug message
   * @param message - The message to log
   * @param context - Optional context object
   * @param traceId - Optional trace ID for request tracking
   */
  debug(message: string, context?: Record<string, any>, traceId?: string): void;

  /**
   * Log an info message
   * @param message - The message to log
   * @param context - Optional context object
   * @param traceId - Optional trace ID for request tracking
   */
  info(message: string, context?: Record<string, any>, traceId?: string): void;

  /**
   * Log a warning message
   * @param message - The message to log
   * @param context - Optional context object
   * @param traceId - Optional trace ID for request tracking
   */
  warn(message: string, context?: Record<string, any>, traceId?: string): void;

  /**
   * Log an error message
   * @param message - The message to log
   * @param error - Optional error object
   * @param context - Optional context object
   * @param traceId - Optional trace ID for request tracking
   */
  error(message: string, error?: Error, context?: Record<string, any>, traceId?: string): void;

  /**
   * Log a fatal error message
   * @param message - The message to log
   * @param error - Optional error object
   * @param context - Optional context object
   * @param traceId - Optional trace ID for request tracking
   */
  fatal(message: string, error?: Error, context?: Record<string, any>, traceId?: string): void;

  /**
   * Create a child logger with additional context
   * @param context - Additional context to include in all log messages
   * @returns A new logger instance with the additional context
   */
  child(context: Record<string, any>): ILogger;

  /**
   * Set the trace ID for the current logger instance
   * @param traceId - The trace ID to set
   * @returns The logger instance for chaining
   */
  setTraceId(traceId: string): ILogger;
}

/**
 * Log levels enum
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

/**
 * Log context interface
 */
export interface LogContext {
  traceId?: string;
  userId?: string;
  requestId?: string;
  operation?: string;
  module?: string;
  method?: string;
  duration?: number;
  [key: string]: any;
}

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    statusCode?: number;
  };
} 