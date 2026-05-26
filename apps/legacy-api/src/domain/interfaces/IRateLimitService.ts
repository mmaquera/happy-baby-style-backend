/**
 * Domain interface for rate limiting functionality
 * Defines the contract for rate limiting operations
 * following Clean Architecture principles
 */
export interface IRateLimitService {
  /**
   * Check if a request is allowed based on rate limiting rules
   * @param key - Unique identifier for rate limiting (IP, userId, etc.)
   * @param endpoint - The endpoint being accessed
   * @returns Promise<boolean> - true if request is allowed, false if blocked
   */
  isRequestAllowed(key: string, endpoint: string): Promise<boolean>;

  /**
   * Record a request for rate limiting purposes
   * @param key - Unique identifier for rate limiting
   * @param endpoint - The endpoint being accessed
   * @param success - Whether the request was successful
   */
  recordRequest(key: string, endpoint: string, success: boolean): Promise<void>;

  /**
   * Get current rate limit status for a key
   * @param key - Unique identifier for rate limiting
   * @param endpoint - The endpoint being accessed
   * @returns Promise<RateLimitStatus> - Current status and remaining requests
   */
  getRateLimitStatus(key: string, endpoint: string): Promise<RateLimitStatus>;

  /**
   * Reset rate limiting for a specific key
   * @param key - Unique identifier for rate limiting
   * @param endpoint - The endpoint being accessed
   */
  resetRateLimit(key: string, endpoint: string): Promise<void>;

  /**
   * Get rate limiting configuration for an endpoint
   * @param endpoint - The endpoint to get configuration for
   * @returns RateLimitConfig - Configuration for the endpoint
   */
  getEndpointConfig(endpoint: string): RateLimitConfig;
}

/**
 * Rate limiting status information
 */
export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  blocked: boolean;
  blockedUntil?: Date;
}

/**
 * Rate limiting configuration for endpoints
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  blockDuration: number; // Duration to block after limit exceeded
  skipSuccessfulRequests: boolean; // Whether to skip successful requests
  message: string; // Message to return when limit exceeded
}

/**
 * Rate limiting event types for tracking
 */
export enum RateLimitEventType {
  REQUEST_ALLOWED = 'request_allowed',
  REQUEST_BLOCKED = 'request_blocked',
  LIMIT_EXCEEDED = 'limit_exceeded',
  RATE_LIMIT_RESET = 'rate_limit_reset',
}

/**
 * Rate limiting event for audit logging
 */
export interface RateLimitEvent {
  id: string;
  key: string;
  endpoint: string;
  eventType: RateLimitEventType;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}
