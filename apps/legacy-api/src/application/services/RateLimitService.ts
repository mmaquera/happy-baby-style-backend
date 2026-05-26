import {
  IRateLimitService,
  RateLimitStatus,
  RateLimitConfig,
  RateLimitEvent,
  RateLimitEventType,
} from '@domain/interfaces/IRateLimitService';
import { ILogger } from '@hbs/logging';
import { RateLimitConfigService } from '../../config/rateLimitConfig';
import { LoggingDecorator } from '@hbs/logging';
import { ValidationError } from '@domain/errors/DomainError';

/**
 * Application service for rate limiting
 * Implements business logic for rate limiting operations
 * following Clean Architecture principles
 */
export class RateLimitService implements IRateLimitService {
  private readonly configService: RateLimitConfigService;
  private readonly logger: ILogger;

  // In-memory storage for rate limiting (in production, use Redis)
  private readonly requestCounts: Map<
    string,
    { count: number; resetTime: Date; blockedUntil?: Date }
  > = new Map();

  constructor(logger: ILogger) {
    this.configService = RateLimitConfigService.getInstance();
    this.logger = logger;
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { service: 'RateLimitService' },
  })
  async isRequestAllowed(key: string, endpoint: string): Promise<boolean> {
    this.logger.info('Checking rate limit', {
      key: this.sanitizeKey(key),
      endpoint,
      operation: 'isRequestAllowed',
    });

    try {
      // Check if currently blocked
      const isBlocked = await this.isCurrentlyBlocked(key, endpoint);
      if (isBlocked) {
        await this.recordRateLimitEvent(key, endpoint, RateLimitEventType.REQUEST_BLOCKED);
        return false;
      }

      // Get current count and check limits
      const currentStatus = await this.getRateLimitStatus(key, endpoint);

      if (currentStatus.allowed) {
        await this.recordRateLimitEvent(key, endpoint, RateLimitEventType.REQUEST_ALLOWED);
        return true;
      } else {
        await this.recordRateLimitEvent(key, endpoint, RateLimitEventType.LIMIT_EXCEEDED);
        return false;
      }
    } catch (error) {
      this.logger.error('Error checking rate limit', error as Error, {
        key: this.sanitizeKey(key),
        endpoint,
        operation: 'isRequestAllowed',
      });

      // In case of error, allow the request (fail open for security)
      return true;
    }
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: false,
    includeDuration: true,
    context: { service: 'RateLimitService' },
  })
  async recordRequest(key: string, endpoint: string, success: boolean): Promise<void> {
    this.logger.info('Recording request for rate limiting', {
      key: this.sanitizeKey(key),
      endpoint,
      success,
      operation: 'recordRequest',
    });

    try {
      const config = this.configService.getEndpointConfig(endpoint);
      const storageKey = this.getStorageKey(key, endpoint);
      const now = new Date();

      // Get current state
      const current = this.requestCounts.get(storageKey);

      if (!current || now > current.resetTime) {
        // Reset window or create new entry
        const resetTime = new Date(now.getTime() + config.windowMs);
        this.requestCounts.set(storageKey, {
          count: 1,
          resetTime,
        });
      } else {
        // Increment count
        current.count++;

        // Check if limit exceeded
        if (current.count > config.maxRequests) {
          const blockUntil = new Date(now.getTime() + config.blockDuration);
          current.blockedUntil = blockUntil;

          this.logger.warn('Rate limit exceeded', {
            key: this.sanitizeKey(key),
            endpoint,
            count: current.count,
            maxRequests: config.maxRequests,
            blockedUntil: blockUntil,
            operation: 'recordRequest',
          });
        }
      }
    } catch (error) {
      this.logger.error('Error recording request', error as Error, {
        key: this.sanitizeKey(key),
        endpoint,
        success,
        operation: 'recordRequest',
      });
    }
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { service: 'RateLimitService' },
  })
  async getRateLimitStatus(key: string, endpoint: string): Promise<RateLimitStatus> {
    this.logger.info('Getting rate limit status', {
      key: this.sanitizeKey(key),
      endpoint,
      operation: 'getRateLimitStatus',
    });

    try {
      const config = this.configService.getEndpointConfig(endpoint);
      const storageKey = this.getStorageKey(key, endpoint);
      const now = new Date();

      const current = this.requestCounts.get(storageKey);

      if (!current || now > current.resetTime) {
        // No current window or expired
        return {
          allowed: true,
          remaining: config.maxRequests,
          resetTime: new Date(now.getTime() + config.windowMs),
          blocked: false,
        };
      }

      // Check if currently blocked
      if (current.blockedUntil && now < current.blockedUntil) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: current.resetTime,
          blocked: true,
          blockedUntil: current.blockedUntil,
        };
      }

      // Check if within limits
      const remaining = Math.max(0, config.maxRequests - current.count);
      const allowed = remaining > 0;

      return {
        allowed,
        remaining,
        resetTime: current.resetTime,
        blocked: false,
      };
    } catch (error) {
      this.logger.error('Error getting rate limit status', error as Error, {
        key: this.sanitizeKey(key),
        endpoint,
        operation: 'getRateLimitStatus',
      });

      // Return default status in case of error
      return {
        allowed: true,
        remaining: 100,
        resetTime: new Date(Date.now() + 15 * 60 * 1000),
        blocked: false,
      };
    }
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: false,
    includeDuration: true,
    context: { service: 'RateLimitService' },
  })
  async resetRateLimit(key: string, endpoint: string): Promise<void> {
    this.logger.info('Resetting rate limit', {
      key: this.sanitizeKey(key),
      endpoint,
      operation: 'resetRateLimit',
    });

    try {
      const storageKey = this.getStorageKey(key, endpoint);
      this.requestCounts.delete(storageKey);

      await this.recordRateLimitEvent(key, endpoint, RateLimitEventType.RATE_LIMIT_RESET);

      this.logger.info('Rate limit reset successfully', {
        key: this.sanitizeKey(key),
        endpoint,
        operation: 'resetRateLimit',
      });
    } catch (error) {
      this.logger.error('Error resetting rate limit', error as Error, {
        key: this.sanitizeKey(key),
        endpoint,
        operation: 'resetRateLimit',
      });
    }
  }

  getEndpointConfig(endpoint: string): RateLimitConfig {
    return this.configService.getEndpointConfig(endpoint);
  }

  /**
   * Get comprehensive rate limiting statistics
   */
  async getRateLimitStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    try {
      for (const [key, data] of this.requestCounts) {
        const [identifier, endpoint] = key.split('|');
        if (!stats[endpoint]) {
          stats[endpoint] = { activeKeys: 0, totalRequests: 0, blockedKeys: 0 };
        }

        stats[endpoint].activeKeys++;
        stats[endpoint].totalRequests += data.count;

        if (data.blockedUntil && new Date() < data.blockedUntil) {
          stats[endpoint].blockedKeys++;
        }
      }

      return stats;
    } catch (error) {
      this.logger.error('Error getting rate limit stats', error as Error, {
        operation: 'getRateLimitStats',
      });
      return {};
    }
  }

  /**
   * Clean up expired rate limiting data
   */
  async cleanupExpiredData(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    try {
      for (const [key, data] of this.requestCounts) {
        if (now > data.resetTime && (!data.blockedUntil || now > data.blockedUntil)) {
          this.requestCounts.delete(key);
          cleanedCount++;
        }
      }

      this.logger.info('Cleaned up expired rate limiting data', {
        cleanedCount,
        operation: 'cleanupExpiredData',
      });

      return cleanedCount;
    } catch (error) {
      this.logger.error('Error cleaning up expired data', error as Error, {
        operation: 'cleanupExpiredData',
      });
      return 0;
    }
  }

  // Private helper methods
  private async isCurrentlyBlocked(key: string, endpoint: string): Promise<boolean> {
    const storageKey = this.getStorageKey(key, endpoint);
    const current = this.requestCounts.get(storageKey);

    if (current?.blockedUntil) {
      return new Date() < current.blockedUntil;
    }

    return false;
  }

  private getStorageKey(key: string, endpoint: string): string {
    return `${key}|${endpoint}`;
  }

  private sanitizeKey(key: string): string {
    // Sanitize key for logging (don't log sensitive information)
    if (key.length > 20) {
      return `${key.substring(0, 8)}...${key.substring(key.length - 8)}`;
    }
    return key;
  }

  private async recordRateLimitEvent(
    key: string,
    endpoint: string,
    eventType: RateLimitEventType,
  ): Promise<void> {
    const event: RateLimitEvent = {
      id: `rate-limit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      key: this.sanitizeKey(key),
      endpoint,
      eventType,
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'RateLimitService',
      },
      timestamp: new Date(),
    };

    this.logger.info('Rate limit event recorded', {
      eventId: event.id,
      eventType,
      key: event.key,
      endpoint,
      operation: 'recordRateLimitEvent',
    });
  }
}
