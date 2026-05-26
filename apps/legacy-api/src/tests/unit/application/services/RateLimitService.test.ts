import { RateLimitService } from '@application/services/RateLimitService';
import {
  IRateLimitService,
  RateLimitStatus,
  RateLimitConfig,
} from '@domain/interfaces/IRateLimitService';
import { ILogger } from '@hbs/logging';
import { RateLimitConfigService } from '../../../../config/rateLimitConfig';

describe('RateLimitService', () => {
  let rateLimitService: RateLimitService;
  let mockLogger: jest.Mocked<ILogger>;
  let mockConfigService: jest.Mocked<RateLimitConfigService>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn(),
      setTraceId: jest.fn(),
    };

    // Create mock config service
    mockConfigService = {
      getInstance: jest.fn(),
      getEndpointConfig: jest.fn(),
      getAllConfigs: jest.fn(),
      updateEndpointConfig: jest.fn(),
      addEndpointConfig: jest.fn(),
      removeEndpointConfig: jest.fn(),
      getConfigSummary: jest.fn(),
    } as any;

    // Mock the RateLimitConfigService class
    jest.doMock('../../../../config/rateLimitConfig', () => ({
      RateLimitConfigService: {
        getInstance: jest.fn().mockReturnValue(mockConfigService),
      },
    }));

    // Re-import to get the mocked version
    const {
      RateLimitService: MockedRateLimitService,
    } = require('../../../../application/services/RateLimitService');
    rateLimitService = new MockedRateLimitService(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isRequestAllowed', () => {
    const testKey = 'test-ip-123';
    const testEndpoint = 'loginUser';

    beforeEach(() => {
      mockConfigService.getEndpointConfig.mockReturnValue({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
        blockDuration: 30 * 60 * 1000, // 30 minutes
        skipSuccessfulRequests: true,
        message: 'Too many login attempts',
      });
    });

    it('should allow request when no previous requests exist', async () => {
      const result = await rateLimitService.isRequestAllowed(testKey, testEndpoint);

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Checking rate limit', expect.any(Object));
    });

    it('should allow request when within limits', async () => {
      // Record 3 requests first
      await rateLimitService.recordRequest(testKey, testEndpoint, true);
      await rateLimitService.recordRequest(testKey, testEndpoint, true);
      await rateLimitService.recordRequest(testKey, testEndpoint, true);

      const result = await rateLimitService.isRequestAllowed(testKey, testEndpoint);

      expect(result).toBe(true);
    });

    it('should block request when limit exceeded', async () => {
      // Record 6 requests (exceeding limit of 5)
      for (let i = 0; i < 6; i++) {
        await rateLimitService.recordRequest(testKey, testEndpoint, true);
      }

      const result = await rateLimitService.isRequestAllowed(testKey, testEndpoint);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Rate limit exceeded', expect.any(Object));
    });

    it('should block request when currently blocked', async () => {
      // Record 6 requests to trigger blocking
      for (let i = 0; i < 6; i++) {
        await rateLimitService.recordRequest(testKey, testEndpoint, true);
      }

      // First call should block due to limit exceeded
      await rateLimitService.isRequestAllowed(testKey, testEndpoint);

      // Second call should block due to being currently blocked
      const result = await rateLimitService.isRequestAllowed(testKey, testEndpoint);

      expect(result).toBe(false);
    });

    it('should allow request after block duration expires', async () => {
      // Mock a shorter block duration for testing
      mockConfigService.getEndpointConfig.mockReturnValue({
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
        blockDuration: 100, // 100ms for testing
        skipSuccessfulRequests: true,
        message: 'Too many login attempts',
      });

      // Record 6 requests to trigger blocking
      for (let i = 0; i < 6; i++) {
        await rateLimitService.recordRequest(testKey, testEndpoint, true);
      }

      // Wait for block duration to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result = await rateLimitService.isRequestAllowed(testKey, testEndpoint);

      expect(result).toBe(true);
    });

    it('should handle errors gracefully and allow request', async () => {
      mockConfigService.getEndpointConfig.mockImplementation(() => {
        throw new Error('Config service error');
      });

      const result = await rateLimitService.isRequestAllowed(testKey, testEndpoint);

      expect(result).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error checking rate limit',
        expect.any(Error),
        expect.any(Object),
      );
    });
  });

  describe('recordRequest', () => {
    const testKey = 'test-ip-456';
    const testEndpoint = 'registerUser';

    beforeEach(() => {
      mockConfigService.getEndpointConfig.mockReturnValue({
        windowMs: 15 * 60 * 1000,
        maxRequests: 3,
        blockDuration: 60 * 60 * 1000, // 1 hour
        skipSuccessfulRequests: true,
        message: 'Too many registration attempts',
      });
    });

    it('should create new entry for first request', async () => {
      await rateLimitService.recordRequest(testKey, testEndpoint, true);

      const status = await rateLimitService.getRateLimitStatus(testKey, testEndpoint);
      expect(status.remaining).toBe(2); // 3 - 1 = 2
      expect(status.allowed).toBe(true);
    });

    it('should increment count for subsequent requests', async () => {
      await rateLimitService.recordRequest(testKey, testEndpoint, true);
      await rateLimitService.recordRequest(testKey, testEndpoint, true);

      const status = await rateLimitService.getRateLimitStatus(testKey, testEndpoint);
      expect(status.remaining).toBe(1); // 3 - 2 = 1
    });

    it('should reset window when expired', async () => {
      // Mock a shorter window for testing
      mockConfigService.getEndpointConfig.mockReturnValue({
        windowMs: 100, // 100ms for testing
        maxRequests: 3,
        blockDuration: 60 * 60 * 1000,
        skipSuccessfulRequests: true,
        message: 'Too many registration attempts',
      });

      // Record first request
      await rateLimitService.recordRequest(testKey, testEndpoint, true);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Record second request (should reset window)
      await rateLimitService.recordRequest(testKey, testEndpoint, true);

      const status = await rateLimitService.getRateLimitStatus(testKey, testEndpoint);
      expect(status.remaining).toBe(2); // Should be 2, not 1
    });

    it('should handle successful vs failed requests correctly', async () => {
      // Record failed request
      await rateLimitService.recordRequest(testKey, testEndpoint, false);

      // Record successful request
      await rateLimitService.recordRequest(testKey, testEndpoint, true);

      const status = await rateLimitService.getRateLimitStatus(testKey, testEndpoint);
      expect(status.remaining).toBe(1); // 3 - 2 = 1
    });
  });

  describe('getRateLimitStatus', () => {
    const testKey = 'test-ip-789';
    const testEndpoint = 'refreshToken';

    beforeEach(() => {
      mockConfigService.getEndpointConfig.mockReturnValue({
        windowMs: 15 * 60 * 1000,
        maxRequests: 20,
        blockDuration: 15 * 60 * 1000,
        skipSuccessfulRequests: false,
        message: 'Too many refresh attempts',
      });
    });

    it('should return default status for new key', async () => {
      const status = await rateLimitService.getRateLimitStatus(testKey, testEndpoint);

      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(20);
      expect(status.blocked).toBe(false);
      expect(status.resetTime).toBeInstanceOf(Date);
    });

    it('should return correct status for existing key', async () => {
      // Record some requests
      await rateLimitService.recordRequest(testKey, testEndpoint, true);
      await rateLimitService.recordRequest(testKey, testEndpoint, true);

      const status = await rateLimitService.getRateLimitStatus(testKey, testEndpoint);

      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(18); // 20 - 2 = 18
      expect(status.blocked).toBe(false);
    });

    it('should return blocked status when limit exceeded', async () => {
      // Record 21 requests (exceeding limit of 20)
      for (let i = 0; i < 21; i++) {
        await rateLimitService.recordRequest(testKey, testEndpoint, true);
      }

      const status = await rateLimitService.getRateLimitStatus(testKey, testEndpoint);

      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
      expect(status.blocked).toBe(true);
      expect(status.blockedUntil).toBeInstanceOf(Date);
    });
  });

  describe('resetRateLimit', () => {
    const testKey = 'test-ip-reset';
    const testEndpoint = 'logoutUser';

    it('should reset rate limit for specific key and endpoint', async () => {
      // Record some requests
      await rateLimitService.recordRequest(testKey, testEndpoint, true);
      await rateLimitService.recordRequest(testKey, testEndpoint, true);

      // Verify requests were recorded
      let status = await rateLimitService.getRateLimitStatus(testKey, testEndpoint);
      expect(status.remaining).toBe(8); // 10 - 2 = 8

      // Reset rate limit
      await rateLimitService.resetRateLimit(testKey, testEndpoint);

      // Verify reset
      status = await rateLimitService.getRateLimitStatus(testKey, testEndpoint);
      expect(status.remaining).toBe(10); // Should be back to max
      expect(status.allowed).toBe(true);
    });
  });

  describe('getRateLimitStats', () => {
    it('should return comprehensive statistics', async () => {
      const testKey1 = 'test-ip-stats-1';
      const testKey2 = 'test-ip-stats-2';
      const testEndpoint = 'default';

      // Record requests for different keys
      await rateLimitService.recordRequest(testKey1, testEndpoint, true);
      await rateLimitService.recordRequest(testKey1, testEndpoint, true);
      await rateLimitService.recordRequest(testKey2, testEndpoint, true);

      const stats = await rateLimitService.getRateLimitStats();

      expect(stats[testEndpoint]).toBeDefined();
      expect(stats[testEndpoint].activeKeys).toBe(2);
      expect(stats[testEndpoint].totalRequests).toBe(3);
      expect(stats[testEndpoint].blockedKeys).toBe(0);
    });
  });

  describe('cleanupExpiredData', () => {
    it('should clean up expired rate limiting data', async () => {
      const testKey = 'test-ip-cleanup';
      const testEndpoint = 'default';

      // Mock a very short window for testing
      mockConfigService.getEndpointConfig.mockReturnValue({
        windowMs: 50, // 50ms for testing
        maxRequests: 100,
        blockDuration: 100, // 100ms for testing
        skipSuccessfulRequests: false,
        message: 'Too many requests',
      });

      // Record a request
      await rateLimitService.recordRequest(testKey, testEndpoint, true);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clean up expired data
      const cleanedCount = await rateLimitService.cleanupExpiredData();

      expect(cleanedCount).toBe(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned up expired rate limiting data',
        expect.any(Object),
      );
    });
  });

  describe('getEndpointConfig', () => {
    it('should return configuration for specific endpoint', () => {
      const config = rateLimitService.getEndpointConfig('loginUser');

      expect(config).toBeDefined();
      expect(config.maxRequests).toBe(5);
      expect(config.windowMs).toBe(15 * 60 * 1000);
    });
  });
});
