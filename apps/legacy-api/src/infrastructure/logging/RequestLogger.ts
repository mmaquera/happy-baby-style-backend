import { Request, Response, NextFunction } from 'express';
import { ILogger } from '@domain/interfaces/ILogger';
import { LoggerFactory } from './LoggerFactory';
import { PerformanceLogger } from './PerformanceLogger';

/**
 * Request logging context interface
 */
export interface RequestLogContext {
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
  requestId?: string;
  traceId?: string;
  query?: Record<string, any>;
  body?: Record<string, any>;
  params?: Record<string, any>;
  headers?: Record<string, any>;
  responseTime?: number;
  statusCode?: number;
  contentLength?: number;
}

/**
 * Request logger for HTTP request logging
 * Provides middleware and utilities for logging HTTP requests
 */
export class RequestLogger {
  private logger: ILogger;
  private performanceLogger: PerformanceLogger;

  constructor() {
    this.logger = LoggerFactory.getInstance().createRequestLogger();
    this.performanceLogger = new PerformanceLogger();
  }

  /**
   * Express middleware for logging HTTP requests
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();
      const traceId = req.headers['x-trace-id'] as string || this.generateTraceId();

      // Add request ID and trace ID to request object
      (req as any).requestId = requestId;
      (req as any).traceId = traceId;

      // Log request start
      this.logRequestStart(req, requestId, traceId);

      // Override res.end to log response
      const originalEnd = res.end;
      const self = this;
      (res as any).end = function(chunk?: any, encoding?: any) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Log response
        self.logResponse(req, res, responseTime, requestId, traceId);

        // Call original end method
        originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Log request start
   */
  private logRequestStart(req: Request, requestId: string, traceId: string): void {
    const context: RequestLogContext = {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      requestId,
      traceId,
      query: req.query,
      body: this.sanitizeBody(req.body),
      params: req.params,
      headers: this.sanitizeHeaders(req.headers)
    };

    // Add user ID if available
    if ((req as any).user?.id) {
      context.userId = (req as any).user.id;
    }

    this.logger.info(`HTTP ${req.method} ${req.url}`, context, traceId);
  }

  /**
   * Log response
   */
  private logResponse(
    req: Request, 
    res: Response, 
    responseTime: number, 
    requestId: string, 
    traceId: string
  ): void {
    const context: RequestLogContext = {
      method: req.method,
      url: req.url,
      requestId,
      traceId,
      responseTime,
      statusCode: res.statusCode,
      contentLength: parseInt(res.get('Content-Length') || '0')
    };

    // Add user ID if available
    if ((req as any).user?.id) {
      context.userId = (req as any).user.id;
    }

    // Determine log level based on status code
    if (res.statusCode >= 500) {
      this.logger.error(`HTTP ${req.method} ${req.url} - ${res.statusCode}`, undefined, context, traceId);
    } else if (res.statusCode >= 400) {
      this.logger.warn(`HTTP ${req.method} ${req.url} - ${res.statusCode}`, context, traceId);
    } else if (responseTime > 1000) {
      this.logger.warn(`Slow HTTP ${req.method} ${req.url} - ${responseTime}ms`, context, traceId);
    } else {
      this.logger.info(`HTTP ${req.method} ${req.url} - ${res.statusCode} (${responseTime}ms)`, context, traceId);
    }
  }

  /**
   * Log GraphQL request
   */
  logGraphQLRequest(
    operationName: string,
    query: string,
    variables?: Record<string, any>,
    userId?: string,
    traceId?: string
  ): void {
    const context = {
      operation: 'GraphQL',
      operationName,
      query: this.truncateQuery(query),
      variables: this.sanitizeVariables(variables),
      userId,
      traceId
    };

    this.logger.info(`GraphQL Request: ${operationName}`, context, traceId);
  }

  /**
   * Log GraphQL response
   */
  logGraphQLResponse(
    operationName: string,
    duration: number,
    success: boolean,
    errors?: any[],
    userId?: string,
    traceId?: string
  ): void {
    const context = {
      operation: 'GraphQL',
      operationName,
      duration,
      success,
      errors: errors?.map(error => ({
        message: error.message,
        path: error.path,
        extensions: error.extensions
      })),
      userId,
      traceId
    };

    if (!success && errors?.length) {
      this.logger.error(`GraphQL Error: ${operationName}`, new Error(errors[0].message), context, traceId);
    } else if (duration > 1000) {
      this.logger.warn(`Slow GraphQL: ${operationName} - ${duration}ms`, context, traceId);
    } else {
      this.logger.info(`GraphQL Response: ${operationName} (${duration}ms)`, context, traceId);
    }
  }

  /**
   * Log database query
   */
  logDatabaseQuery(
    query: string,
    params: any[],
    duration: number,
    success: boolean,
    error?: Error,
    traceId?: string
  ): void {
    const context = {
      operation: 'Database',
      query: this.truncateQuery(query),
      params: this.sanitizeParams(params),
      duration,
      success,
      traceId
    };

    if (!success && error) {
      this.logger.error(`Database Query Error`, error, context, traceId);
    } else if (duration > 1000) {
      this.logger.warn(`Slow Database Query: ${duration}ms`, context, traceId);
    } else {
      this.logger.debug(`Database Query: ${duration}ms`, context, traceId);
    }
  }

  /**
   * Log authentication event
   */
  logAuthEvent(
    event: 'login' | 'logout' | 'register' | 'password_reset' | 'token_refresh',
    userId: string | undefined,
    success: boolean,
    error?: Error,
    traceId?: string
  ): void {
    const context = {
      operation: 'Authentication',
      event,
      userId,
      success,
      traceId
    };

    if (!success && error) {
      this.logger.error(`Authentication ${event} failed`, error, context, traceId);
    } else {
      this.logger.info(`Authentication ${event} ${success ? 'successful' : 'failed'}`, context, traceId);
    }
  }

  /**
   * Sanitize request body for logging
   */
  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize headers for logging
   */
  private sanitizeHeaders(headers: any): any {
    if (!headers) return headers;

    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize GraphQL variables
   */
  private sanitizeVariables(variables?: Record<string, any>): any {
    if (!variables) return variables;

    const sanitized = { ...variables };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize database parameters
   */
  private sanitizeParams(params: any[]): any[] {
    if (!params || !Array.isArray(params)) return params;

    return params.map(param => {
      if (typeof param === 'string' && param.toLowerCase().includes('password')) {
        return '[REDACTED]';
      }
      return param;
    });
  }

  /**
   * Truncate long queries for logging
   */
  private truncateQuery(query: string, maxLength: number = 200): string {
    if (!query || query.length <= maxLength) return query;
    return query.substring(0, maxLength) + '...';
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Generate unique trace ID
   */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
} 