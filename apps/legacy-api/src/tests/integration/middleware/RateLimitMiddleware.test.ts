import request from 'supertest';
import express from 'express';
import { RateLimitMiddleware } from '@presentation/middleware/RateLimitMiddleware';
import { RateLimitService } from '@application/services/RateLimitService';
import { ILogger } from '@hbs/logging';
import { ResponseFactory } from '@hbs/shared-kernel';

describe('RateLimitMiddleware Integration Tests', () => {
  let app: express.Application;
  let rateLimitService: RateLimitService;
  let rateLimitMiddleware: RateLimitMiddleware;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn(),
      setTraceId: jest.fn()
    };

    // Create rate limit service
    rateLimitService = new RateLimitService(mockLogger);
    
    // Create middleware
    rateLimitMiddleware = new RateLimitMiddleware(rateLimitService, mockLogger);

    // Create Express app for testing
    app = express();
    app.use(express.json());
    
    // Add request ID middleware for testing
    app.use((req, res, next) => {
      (req as any).ip = '127.0.0.1';
      req.headers['x-request-id'] = 'test-request-id';
      next();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('General API Rate Limiting', () => {
    beforeEach(() => {
      // Apply general API rate limiting
      app.use(rateLimitMiddleware.createGeneralAPIMiddleware());
      
      // Add test endpoint
      app.post('/test', (req, res) => {
        res.json({ message: 'Success' });
      });
    });

    it('should allow requests within rate limit', async () => {
      // Make 5 requests (within default limit of 100)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/test')
          .send({ data: `request-${i}` });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Success');
      }

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should block requests when rate limit exceeded', async () => {
      // Mock a very low limit for testing
      jest.spyOn(rateLimitService, 'getEndpointConfig').mockReturnValue({
        windowMs: 15 * 60 * 1000,
        maxRequests: 3,
        blockDuration: 15 * 60 * 1000,
        skipSuccessfulRequests: false,
        message: 'Too many requests from this IP'
      });

      // Make 4 requests (exceeding limit of 3)
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/test')
          .send({ data: `request-${i}` });

        expect(response.status).toBe(200);
      }

      // 4th request should be blocked
      const blockedResponse = await request(app)
        .post('/test')
        .send({ data: 'blocked-request' });

      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.body.success).toBe(false);
      expect(blockedResponse.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(mockLogger.warn).toHaveBeenCalledWith('General API rate limit exceeded', expect.any(Object));
    });

    it('should include rate limit headers in responses', async () => {
      const response = await request(app)
        .post('/test')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Authentication Rate Limiting', () => {
    beforeEach(() => {
      // Apply authentication rate limiting
      app.use(rateLimitMiddleware.createAuthMiddleware());
      
      // Add test auth endpoint
      app.post('/auth/login', (req, res) => {
        res.json({ message: 'Login successful' });
      });
    });

    it('should detect login endpoint and apply strict rate limiting', async () => {
      // Mock strict rate limiting for login
      jest.spyOn(rateLimitService, 'getEndpointConfig').mockReturnValue({
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
        blockDuration: 30 * 60 * 1000,
        skipSuccessfulRequests: true,
        message: 'Too many login attempts. Please try again in 30 minutes.'
      });

      // Make 6 requests (exceeding limit of 5)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/auth/login')
          .send({ 
            query: 'mutation { loginUser(email: "test@example.com", password: "password") { user { id } } }'
          });

        expect(response.status).toBe(200);
      }

      // 6th request should be blocked
      const blockedResponse = await request(app)
        .post('/auth/login')
        .send({ 
          query: 'mutation { loginUser(email: "test@example.com", password: "password") { user { id } } }'
        });

      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.body.success).toBe(false);
      expect(blockedResponse.body.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
      expect(blockedResponse.body.data.securityNote).toBe('This endpoint is protected against brute force attacks');
      expect(mockLogger.warn).toHaveBeenCalledWith('Authentication rate limit exceeded', expect.any(Object));
    });

    it('should detect different auth endpoints correctly', async () => {
      // Test register endpoint
      const registerResponse = await request(app)
        .post('/auth/register')
        .send({ 
          query: 'mutation { registerUser(input: { email: "test@example.com", firstName: "Test", lastName: "User" }) { user { id } } }'
        });

      expect(registerResponse.status).toBe(200);

      // Test refresh token endpoint
      const refreshResponse = await request(app)
        .post('/auth/refresh')
        .send({ 
          query: 'mutation { refreshToken(refreshToken: "token123") { accessToken } }'
        });

      expect(refreshResponse.status).toBe(200);
    });

    it('should include auth-specific rate limit headers', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ 
          query: 'mutation { loginUser(email: "test@example.com", password: "password") { user { id } } }'
        });

      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-endpoint']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Endpoint-Specific Rate Limiting', () => {
    beforeEach(() => {
      // Apply endpoint-specific rate limiting
      app.use('/api/products', rateLimitMiddleware.createEndpointMiddleware('uploadImage'));
      
      // Add test endpoint
      app.post('/api/products/upload', (req, res) => {
        res.json({ message: 'Upload successful' });
      });
    });

    it('should apply specific rate limiting for upload endpoint', async () => {
      // Mock rate limiting for upload
      jest.spyOn(rateLimitService, 'getEndpointConfig').mockReturnValue({
        windowMs: 15 * 60 * 1000,
        maxRequests: 10,
        blockDuration: 15 * 60 * 1000,
        skipSuccessfulRequests: false,
        message: 'Too many file upload attempts. Please try again in 15 minutes.'
      });

      // Make 11 requests (exceeding limit of 10)
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/products/upload')
          .send({ file: `file-${i}.jpg` });

        expect(response.status).toBe(200);
      }

      // 11th request should be blocked
      const blockedResponse = await request(app)
        .post('/api/products/upload')
        .send({ file: 'blocked-file.jpg' });

      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.body.success).toBe(false);
      expect(blockedResponse.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      app.use(rateLimitMiddleware.createGeneralAPIMiddleware());
      
      app.post('/test', (req, res) => {
        res.json({ message: 'Success' });
      });
    });

    it('should handle rate limit service errors gracefully', async () => {
      // Mock rate limit service to throw error
      jest.spyOn(rateLimitService, 'isRequestAllowed').mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/test')
        .send({ data: 'test' });

      // Should allow request when service fails (fail open for security)
      expect(response.status).toBe(200);
      expect(mockLogger.error).toHaveBeenCalledWith('Error in general API rate limiting middleware', expect.any(Error), expect.any(Object));
    });

    it('should handle missing request ID gracefully', async () => {
      // Remove request ID middleware
      app._router.stack = app._router.stack.filter((layer: any) => 
        !layer.name || !layer.name.includes('requestId')
      );

      const response = await request(app)
        .post('/test')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limit Response Structure', () => {
    beforeEach(() => {
      app.use(rateLimitMiddleware.createGeneralAPIMiddleware());
      
      app.post('/test', (req, res) => {
        res.json({ message: 'Success' });
      });
    });

    it('should return properly structured rate limit error response', async () => {
      // Mock very low limit for testing
      jest.spyOn(rateLimitService, 'getEndpointConfig').mockReturnValue({
        windowMs: 15 * 60 * 1000,
        maxRequests: 1,
        blockDuration: 15 * 60 * 1000,
        skipSuccessfulRequests: false,
        message: 'Too many requests from this IP. Please try again in 15 minutes.'
      });

      // First request should succeed
      await request(app)
        .post('/test')
        .send({ data: 'first' });

      // Second request should be blocked
      const blockedResponse = await request(app)
        .post('/test')
        .send({ data: 'second' });

      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.body).toMatchObject({
        success: false,
        message: 'Too many requests from this IP. Please try again in 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED',
        data: {
          endpoint: 'default',
          retryAfter: expect.any(Number),
          limit: 1,
          window: 15 * 60 * 1000
        },
        metadata: {
          requestId: 'test-request-id',
          traceId: expect.stringMatching(/general-rate-limit-\d+/),
          duration: 0
        }
      });
    });
  });
});
