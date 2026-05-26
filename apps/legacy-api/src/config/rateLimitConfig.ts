import { RateLimitConfig } from '@domain/interfaces/IRateLimitService';

/**
 * Centralized rate limiting configuration
 * Follows security best practices for authentication endpoints
 */
export class RateLimitConfigService {
  private static instance: RateLimitConfigService;

  private readonly endpointConfigs: Map<string, RateLimitConfig> = new Map();

  private constructor() {
    this.initializeConfigs();
  }

  static getInstance(): RateLimitConfigService {
    if (!this.instance) {
      this.instance = new RateLimitConfigService();
    }
    return this.instance;
  }

  private initializeConfigs(): void {
    // Authentication endpoints - Most restrictive
    this.endpointConfigs.set('loginUser', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 attempts per window
      blockDuration: 30 * 60 * 1000, // 30 minutes block
      skipSuccessfulRequests: true,
      message: 'Too many login attempts. Please try again in 30 minutes.',
    });

    this.endpointConfigs.set('registerUser', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 3, // 3 registration attempts per window
      blockDuration: 60 * 60 * 1000, // 1 hour block
      skipSuccessfulRequests: true,
      message: 'Too many registration attempts. Please try again in 1 hour.',
    });

    this.endpointConfigs.set('refreshToken', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 20, // 20 refresh attempts per window
      blockDuration: 15 * 60 * 1000, // 15 minutes block
      skipSuccessfulRequests: false,
      message: 'Too many token refresh attempts. Please try again in 15 minutes.',
    });

    this.endpointConfigs.set('logoutUser', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10, // 10 logout attempts per window
      blockDuration: 15 * 60 * 1000, // 15 minutes block
      skipSuccessfulRequests: true,
      message: 'Too many logout attempts. Please try again in 15 minutes.',
    });

    // Password reset endpoints
    this.endpointConfigs.set('requestPasswordReset', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 3, // 3 reset requests per window
      blockDuration: 60 * 60 * 1000, // 1 hour block
      skipSuccessfulRequests: true,
      message: 'Too many password reset requests. Please try again in 1 hour.',
    });

    this.endpointConfigs.set('resetPassword', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 reset attempts per window
      blockDuration: 30 * 60 * 1000, // 30 minutes block
      skipSuccessfulRequests: true,
      message: 'Too many password reset attempts. Please try again in 30 minutes.',
    });

    // General API endpoints - Less restrictive
    this.endpointConfigs.set('default', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per window
      blockDuration: 15 * 60 * 1000, // 15 minutes block
      skipSuccessfulRequests: false,
      message: 'Too many requests from this IP. Please try again in 15 minutes.',
    });

    // File upload endpoints
    this.endpointConfigs.set('uploadImage', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10, // 10 uploads per window
      blockDuration: 15 * 60 * 1000, // 15 minutes block
      skipSuccessfulRequests: false,
      message: 'Too many file upload attempts. Please try again in 15 minutes.',
    });

    // Admin endpoints - Moderate restriction
    this.endpointConfigs.set('admin', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50, // 50 requests per window
      blockDuration: 15 * 60 * 1000, // 15 minutes block
      skipSuccessfulRequests: false,
      message: 'Too many admin requests. Please try again in 15 minutes.',
    });
  }

  /**
   * Get configuration for a specific endpoint
   */
  getEndpointConfig(endpoint: string): RateLimitConfig {
    return this.endpointConfigs.get(endpoint) || this.endpointConfigs.get('default')!;
  }

  /**
   * Get all endpoint configurations
   */
  getAllConfigs(): Map<string, RateLimitConfig> {
    return new Map(this.endpointConfigs);
  }

  /**
   * Update configuration for an endpoint (useful for dynamic configuration)
   */
  updateEndpointConfig(endpoint: string, config: Partial<RateLimitConfig>): void {
    const existingConfig = this.endpointConfigs.get(endpoint);
    if (existingConfig) {
      this.endpointConfigs.set(endpoint, { ...existingConfig, ...config });
    }
  }

  /**
   * Add new endpoint configuration
   */
  addEndpointConfig(endpoint: string, config: RateLimitConfig): void {
    this.endpointConfigs.set(endpoint, config);
  }

  /**
   * Remove endpoint configuration
   */
  removeEndpointConfig(endpoint: string): void {
    this.endpointConfigs.delete(endpoint);
  }

  /**
   * Get configuration summary for monitoring
   */
  getConfigSummary(): Record<string, { maxRequests: number; windowMs: number }> {
    const summary: Record<string, { maxRequests: number; windowMs: number }> = {};

    for (const [endpoint, config] of this.endpointConfigs) {
      summary[endpoint] = {
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
      };
    }

    return summary;
  }
}
