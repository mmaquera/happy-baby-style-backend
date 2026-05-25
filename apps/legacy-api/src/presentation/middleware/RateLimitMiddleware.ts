import { Request, Response, NextFunction } from 'express';
import { IRateLimitService } from '@domain/interfaces/IRateLimitService';
import { ILogger } from '@domain/interfaces/ILogger';
import { ResponseFactory } from '@shared/factories/ResponseFactory';
import { RESPONSE_CODES } from '@shared/constants/ResponseCodes';

/**
 * Express middleware for rate limiting
 * Integrates with the rate limiting service
 * following Clean Architecture principles
 */
export class RateLimitMiddleware {
  constructor(
    private rateLimitService: IRateLimitService,
    private logger: ILogger
  ) {}

  /**
   * Create middleware for a specific endpoint
   */
  createEndpointMiddleware(endpoint: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.generateKey(req, endpoint);
        
        // Check if request is allowed
        const isAllowed = await this.rateLimitService.isRequestAllowed(key, endpoint);
        
        if (!isAllowed) {
          const config = this.rateLimitService.getEndpointConfig(endpoint);
          
          this.logger.warn('Rate limit exceeded', {
            endpoint,
            key: this.sanitizeKey(key),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            operation: 'RateLimitMiddleware'
          });

          // Return rate limit exceeded response
          const response = ResponseFactory.createErrorResponse(
            config.message,
            'RATE_LIMIT_EXCEEDED',
            {
              endpoint,
              retryAfter: this.calculateRetryAfter(req, endpoint),
              limit: config.maxRequests,
              window: config.windowMs
            },
            {
              requestId: req.headers['x-request-id'] as string,
              traceId: `rate-limit-${Date.now()}`,
              duration: 0
            }
          );

          res.status(429).json(response);
          return;
        }

        // Record the request
        await this.rateLimitService.recordRequest(key, endpoint, false); // Will be updated after response

        // Add rate limit headers to response
        res.on('finish', async () => {
          try {
            const success = res.statusCode < 400;
            await this.rateLimitService.recordRequest(key, endpoint, success);
            
            // Add rate limit headers
            const status = await this.rateLimitService.getRateLimitStatus(key, endpoint);
            res.set({
              'X-RateLimit-Limit': this.rateLimitService.getEndpointConfig(endpoint).maxRequests,
              'X-RateLimit-Remaining': status.remaining,
              'X-RateLimit-Reset': Math.floor(status.resetTime.getTime() / 1000)
            });
          } catch (error) {
            this.logger.error('Error updating rate limit after response', error as Error, {
              endpoint,
              key: this.sanitizeKey(key),
              operation: 'RateLimitMiddleware'
            });
          }
        });

        next();
      } catch (error) {
        this.logger.error('Error in rate limiting middleware', error as Error, {
          endpoint,
          ipAddress: req.ip,
          operation: 'RateLimitMiddleware'
        });
        
        // In case of error, allow the request (fail open for security)
        next();
      }
    };
  }

  /**
   * Create middleware for authentication endpoints (most restrictive)
   */
  createAuthMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Determine the specific auth endpoint
        const endpoint = this.determineAuthEndpoint(req);
        const key = this.generateKey(req, endpoint);
        
        // Check if request is allowed
        const isAllowed = await this.rateLimitService.isRequestAllowed(key, endpoint);
        
        if (!isAllowed) {
          const config = this.rateLimitService.getEndpointConfig(endpoint);
          
          this.logger.warn('Authentication rate limit exceeded', {
            endpoint,
            key: this.sanitizeKey(key),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            operation: 'RateLimitMiddleware'
          });

          // Return authentication rate limit exceeded response
          const response = ResponseFactory.createErrorResponse(
            config.message,
            'AUTH_RATE_LIMIT_EXCEEDED',
            {
              endpoint,
              retryAfter: this.calculateRetryAfter(req, endpoint),
              limit: config.maxRequests,
              window: config.windowMs,
              securityNote: 'This endpoint is protected against brute force attacks'
            },
            {
              requestId: req.headers['x-request-id'] as string,
              traceId: `auth-rate-limit-${Date.now()}`,
              duration: 0
            }
          );

          res.status(429).json(response);
          return;
        }

        // Record the request
        await this.rateLimitService.recordRequest(key, endpoint, false);

        // Add rate limit headers to response
        res.on('finish', async () => {
          try {
            const success = res.statusCode < 400;
            await this.rateLimitService.recordRequest(key, endpoint, success);
            
            // Add rate limit headers
            const status = await this.rateLimitService.getRateLimitStatus(key, endpoint);
            res.set({
              'X-RateLimit-Limit': this.rateLimitService.getEndpointConfig(endpoint).maxRequests,
              'X-RateLimit-Remaining': status.remaining,
              'X-RateLimit-Reset': Math.floor(status.resetTime.getTime() / 1000),
              'X-RateLimit-Endpoint': endpoint
            });
          } catch (error) {
            this.logger.error('Error updating auth rate limit after response', error as Error, {
              endpoint,
              key: this.sanitizeKey(key),
              operation: 'RateLimitMiddleware'
            });
          }
        });

        next();
      } catch (error) {
        this.logger.error('Error in auth rate limiting middleware', error as Error, {
          ipAddress: req.ip,
          operation: 'RateLimitMiddleware'
        });
        
        // In case of error, allow the request (fail open for security)
        next();
      }
    };
  }

  /**
   * Create middleware for general API endpoints (less restrictive)
   */
  createGeneralAPIMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const endpoint = 'default'; // Use default configuration
        const key = this.generateKey(req, endpoint);
        
        // Check if request is allowed
        const isAllowed = await this.rateLimitService.isRequestAllowed(key, endpoint);
        
        if (!isAllowed) {
          const config = this.rateLimitService.getEndpointConfig(endpoint);
          
          this.logger.warn('General API rate limit exceeded', {
            endpoint,
            key: this.sanitizeKey(key),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            operation: 'RateLimitMiddleware'
          });

          // Return general rate limit exceeded response
          const response = ResponseFactory.createErrorResponse(
            config.message,
            'RATE_LIMIT_EXCEEDED',
            {
              endpoint,
              retryAfter: this.calculateRetryAfter(req, endpoint),
              limit: config.maxRequests,
              window: config.windowMs
            },
            {
              requestId: req.headers['x-request-id'] as string,
              traceId: `general-rate-limit-${Date.now()}`,
              duration: 0
            }
          );

          res.status(429).json(response);
          return;
        }

        // Record the request
        await this.rateLimitService.recordRequest(key, endpoint, false);

        // Add rate limit headers to response
        res.on('finish', async () => {
          try {
            const success = res.statusCode < 400;
            await this.rateLimitService.recordRequest(key, endpoint, success);
            
            // Add rate limit headers
            const status = await this.rateLimitService.getRateLimitStatus(key, endpoint);
            res.set({
              'X-RateLimit-Limit': this.rateLimitService.getEndpointConfig(endpoint).maxRequests,
              'X-RateLimit-Remaining': status.remaining,
              'X-RateLimit-Reset': Math.floor(status.resetTime.getTime() / 1000)
            });
          } catch (error) {
            this.logger.error('Error updating general API rate limit after response', error as Error, {
              endpoint,
              key: this.sanitizeKey(key),
              operation: 'RateLimitMiddleware'
            });
          }
        });

        next();
      } catch (error) {
        this.logger.error('Error in general API rate limiting middleware', error as Error, {
          ipAddress: req.ip,
          operation: 'RateLimitMiddleware'
        });
        
        // In case of error, allow the request (fail open for security)
        next();
      }
    };
  }

  // Private helper methods
  private generateKey(req: Request, endpoint: string): string {
    // Generate key based on IP address and user ID if available
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = (req as any).user?.id || 'anonymous';
    
    // For authentication endpoints, use IP + endpoint
    if (this.isAuthEndpoint(endpoint)) {
      return `${ip}-${endpoint}`;
    }
    
    // For general endpoints, use IP + userId if available
    if (userId !== 'anonymous') {
      return `${ip}-${userId}-${endpoint}`;
    }
    
    return `${ip}-${endpoint}`;
  }

  private determineAuthEndpoint(req: Request): string {
    // Determine the specific auth endpoint based on request
    const body = req.body || {};
    
    if (body.query) {
      // GraphQL request
      if (body.query.includes('loginUser')) return 'loginUser';
      if (body.query.includes('registerUser')) return 'registerUser';
      if (body.query.includes('refreshToken')) return 'refreshToken';
      if (body.query.includes('logoutUser')) return 'logoutUser';
      if (body.query.includes('requestPasswordReset')) return 'requestPasswordReset';
      if (body.query.includes('resetPassword')) return 'resetPassword';
    }
    
    // Default to loginUser for unknown auth requests
    return 'loginUser';
  }

  private isAuthEndpoint(endpoint: string): boolean {
    const authEndpoints = [
      'loginUser', 'registerUser', 'refreshToken', 'logoutUser',
      'requestPasswordReset', 'resetPassword'
    ];
    return authEndpoints.includes(endpoint);
  }

  private calculateRetryAfter(req: Request, endpoint: string): number {
    // Calculate retry after based on endpoint configuration
    const config = this.rateLimitService.getEndpointConfig(endpoint);
    return Math.ceil(config.blockDuration / 1000); // Convert to seconds
  }

  private sanitizeKey(key: string): string {
    // Sanitize key for logging
    if (key.length > 30) {
      return `${key.substring(0, 15)}...${key.substring(key.length - 15)}`;
    }
    return key;
  }
}
