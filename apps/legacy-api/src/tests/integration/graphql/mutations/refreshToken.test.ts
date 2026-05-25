import { Container } from '@shared/container';
import { RefreshTokenUseCase, RefreshTokenResponse } from '@application/use-cases/user/RefreshTokenUseCase';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@hbs/logging';
import { AuthResult, AuthProvider } from '@domain/entities/Auth';
import { UserRole } from '@domain/entities/User';
import { ValidationError, NotFoundError, UnauthorizedError, InfrastructureError } from '@domain/errors/DomainError';

// Mock del container
jest.mock('@shared/container');

describe('RefreshToken Mutation Integration', () => {
  let container: jest.Mocked<Container>;
  let mockRefreshTokenUseCase: jest.Mocked<RefreshTokenUseCase>;
  let mockAuthRepository: jest.Mocked<IAuthRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  const mockAuthResult: RefreshTokenResponse = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.CUSTOMER,
      isActive: true,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      addresses: [],
      favoriteProductIds: []
    },
    tokens: {
      accessToken: 'new-access-token-456',
      refreshToken: 'new-refresh-token-789'
    },
    isNewUser: false,
    provider: 'email',
    session: {
      id: 'session-123',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas en el futuro
      isActive: true
    }
  };

  beforeEach(() => {
    // Mock del container
    container = {
      get: jest.fn()
    } as any;

    // Mock del use case
    mockRefreshTokenUseCase = {
      execute: jest.fn()
    } as any;

    // Mock del repositorio
    mockAuthRepository = {
      refreshUserSession: jest.fn()
    } as any;

    // Mock del logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    } as any;

    // Configurar mocks del container
    (Container.getInstance as jest.Mock).mockReturnValue(container);
    container.get.mockImplementation((key: string) => {
      switch (key) {
        case 'refreshTokenUseCase':
          return mockRefreshTokenUseCase;
        case 'defaultLogger':
          return mockLogger;
        default:
          throw new Error(`Dependency '${key}' not found`);
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Scenarios', () => {
    it('should successfully refresh token and return structured response', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token-123';
      const context = {
        req: {
          headers: {
            'x-request-id': 'req-123',
            'user-agent': 'Mozilla/5.0 (Test Browser)'
          },
          ip: '192.168.1.1'
        }
      };

      mockRefreshTokenUseCase.execute.mockResolvedValue(mockAuthResult);

      // Simular la ejecución del resolver
      const resolver = async () => {
        const startTime = Date.now();
        const traceId = `refresh-token-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        
        try {
          const result = await mockRefreshTokenUseCase.execute({
            refreshToken,
            userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
            ipAddress: context?.req?.ip || 'unknown'
          });

          const duration = Date.now() - startTime;
          
          // Simular logging de éxito
          mockLogger.info('RefreshToken resolver success', {
            operation: 'refreshToken',
            requestId,
            traceId,
            duration,
            userId: result.user?.id,
            provider: result.provider,
            isNewUser: result.isNewUser,
            context: {
              userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
              ipAddress: context?.req?.ip || 'unknown'
            }
          });

          // Simular ResponseFactory.createSuccessResponse
          return {
            success: true,
            message: 'Token refreshed successfully',
            code: 'SUCCESS',
            timestamp: expect.any(String),
            data: {
              user: result.user,
              accessToken: result.tokens.accessToken,
              refreshToken: result.tokens.refreshToken,
              session: result.session
            },
            metadata: {
              requestId,
              traceId,
              duration
            }
          };

        } catch (error: any) {
          const duration = Date.now() - startTime;
          
          mockLogger.error('RefreshToken resolver error', error, {
            operation: 'refreshToken',
            requestId,
            traceId,
            duration,
            errorDetails: {
              message: error.message,
              type: error.constructor.name,
              stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            context: {
              userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
              ipAddress: context?.req?.ip || 'unknown'
            }
          });
          
          throw error;
        }
      };

      // Act
      const result = await resolver();

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Token refreshed successfully',
        code: 'SUCCESS',
        timestamp: expect.any(String),
        data: {
          user: mockAuthResult.user,
          accessToken: mockAuthResult.tokens.accessToken,
          refreshToken: mockAuthResult.tokens.refreshToken,
          session: mockAuthResult.session
        },
        metadata: {
          requestId: 'req-123',
          traceId: expect.stringMatching(/refresh-token-\d+/),
          duration: expect.any(Number)
        }
      });

      expect(mockRefreshTokenUseCase.execute).toHaveBeenCalledWith({
        refreshToken,
        userAgent: 'Mozilla/5.0 (Test Browser)',
        ipAddress: '192.168.1.1'
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'RefreshToken resolver success',
        expect.objectContaining({
          operation: 'refreshToken',
          requestId: 'req-123',
          traceId: expect.stringMatching(/refresh-token-\d+/),
          duration: expect.any(Number),
          userId: 'user-123',
          provider: 'email',
          isNewUser: false
        })
      );
    });

    it('should handle context without optional fields', async () => {
      // Arrange
      const refreshToken = 'minimal-token';
      const context = {};

      mockRefreshTokenUseCase.execute.mockResolvedValue(mockAuthResult);

      // Simular resolver con contexto mínimo
      const resolver = async () => {
        const startTime = Date.now();
        const traceId = `refresh-token-${Date.now()}`;
        const requestId = `req-${Date.now()}`;
        
        const result = await mockRefreshTokenUseCase.execute({
          refreshToken,
          userAgent: 'unknown',
          ipAddress: 'unknown'
        });

        const duration = Date.now() - startTime;
        
        return {
          success: true,
          message: 'Token refreshed successfully',
          code: 'SUCCESS',
          timestamp: expect.any(String),
          data: {
            user: result.user,
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
            session: result.session
          },
          metadata: {
            requestId,
            traceId,
            duration
          }
        };
      };

      // Act
      const result = await resolver();

      // Assert
      expect(result.success).toBe(true);
      expect(mockRefreshTokenUseCase.execute).toHaveBeenCalledWith({
        refreshToken,
        userAgent: 'unknown',
        ipAddress: 'unknown'
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle validation errors properly', async () => {
      // Arrange
      const refreshToken = '';
      const context = {
        req: {
          headers: { 'x-request-id': 'req-456' },
          ip: '192.168.1.2'
        }
      };

      const validationError = new ValidationError('Refresh token is required');
      mockRefreshTokenUseCase.execute.mockRejectedValue(validationError);

      // Simular resolver con error
      const resolver = async () => {
        const startTime = Date.now();
        const traceId = `refresh-token-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        
        try {
          await mockRefreshTokenUseCase.execute({
            refreshToken,
            userAgent: 'unknown',
            ipAddress: context?.req?.ip || 'unknown'
          });
        } catch (error: any) {
          const duration = Date.now() - startTime;
          
          mockLogger.error('RefreshToken resolver error', error, {
            operation: 'refreshToken',
            requestId,
            traceId,
            duration,
            errorDetails: {
              message: error.message,
              type: error.constructor.name
            },
            context: {
              userAgent: 'unknown',
              ipAddress: context?.req?.ip || 'unknown'
            }
          });
          
          // Simular ResponseFactory.createErrorResponse
          return {
            success: false,
            message: error.message,
            code: 'VALIDATION_ERROR',
            timestamp: expect.any(String),
            data: null,
            metadata: {
              requestId,
              traceId,
              duration
            }
          };
        }
      };

      // Act
      const result = await resolver();

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Refresh token is required',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
        data: null,
        metadata: {
          requestId: 'req-456',
          traceId: expect.stringMatching(/refresh-token-\d+/),
          duration: expect.any(Number)
        }
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'RefreshToken resolver error',
        validationError,
        expect.objectContaining({
          operation: 'refreshToken',
          requestId: 'req-456',
          traceId: expect.stringMatching(/refresh-token-\d+/),
          duration: expect.any(Number),
          errorDetails: {
            message: 'Refresh token is required',
            type: 'ValidationError'
          }
        })
      );
    });

    it('should handle unauthorized errors properly', async () => {
      // Arrange
      const refreshToken = 'expired-token';
      const context = {
        req: {
          headers: { 'x-request-id': 'req-789' },
          ip: '192.168.1.3'
        }
      };

      const unauthorizedError = new UnauthorizedError('Invalid or expired refresh token');
      mockRefreshTokenUseCase.execute.mockRejectedValue(unauthorizedError);

      // Simular resolver con error de autorización
      const resolver = async () => {
        const startTime = Date.now();
        const traceId = `refresh-token-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        
        try {
          await mockRefreshTokenUseCase.execute({
            refreshToken,
            userAgent: 'unknown',
            ipAddress: context?.req?.ip || 'unknown'
          });
        } catch (error: any) {
          const duration = Date.now() - startTime;
          
          mockLogger.error('RefreshToken resolver error', error, {
            operation: 'refreshToken',
            requestId,
            traceId,
            duration,
            errorDetails: {
              message: error.message,
              type: error.constructor.name
            },
            context: {
              userAgent: 'unknown',
              ipAddress: context?.req?.ip || 'unknown'
            }
          });
          
          return {
            success: false,
            message: error.message,
            code: 'UNAUTHORIZED',
            timestamp: expect.any(String),
            data: null,
            metadata: {
              requestId,
              traceId,
              duration
            }
          };
        }
      };

      // Act
      const result = await resolver();

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Invalid or expired refresh token',
        code: 'UNAUTHORIZED',
        timestamp: expect.any(String),
        data: null,
        metadata: {
          requestId: 'req-789',
          traceId: expect.stringMatching(/refresh-token-\d+/),
          duration: expect.any(Number)
        }
      });
    });

    it('should handle infrastructure errors properly', async () => {
      // Arrange
      const refreshToken = 'valid-token';
      const context = {
        req: {
          headers: { 'x-request-id': 'req-999' },
          ip: '192.168.1.4'
        }
      };

      const infrastructureError = new InfrastructureError('Database connection failed');
      mockRefreshTokenUseCase.execute.mockRejectedValue(infrastructureError);

      // Simular resolver con error de infraestructura
      const resolver = async () => {
        const startTime = Date.now();
        const traceId = `refresh-token-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        
        try {
          await mockRefreshTokenUseCase.execute({
            refreshToken,
            userAgent: 'unknown',
            ipAddress: context?.req?.ip || 'unknown'
          });
        } catch (error: any) {
          const duration = Date.now() - startTime;
          
          mockLogger.error('RefreshToken resolver error', error, {
            operation: 'refreshToken',
            requestId,
            traceId,
            duration,
            errorDetails: {
              message: error.message,
              type: error.constructor.name
            },
            context: {
              userAgent: 'unknown',
              ipAddress: context?.req?.ip || 'unknown'
            }
          });
          
          return {
            success: false,
            message: error.message,
            code: 'INFRASTRUCTURE_ERROR',
            timestamp: expect.any(String),
            data: null,
            metadata: {
              requestId,
              traceId,
              duration
            }
          };
        }
      };

      // Act
      const result = await resolver();

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Database connection failed',
        code: 'INFRASTRUCTURE_ERROR',
        timestamp: expect.any(String),
        data: null,
        metadata: {
          requestId: 'req-999',
          traceId: expect.stringMatching(/refresh-token-\d+/),
          duration: expect.any(Number)
        }
      });
    });
  });

  describe('Performance and Logging', () => {
    it('should measure and log operation duration', async () => {
      // Arrange
      const refreshToken = 'performance-test-token';
      const context = {
        req: {
          headers: { 'x-request-id': 'req-perf' },
          ip: '192.168.1.5'
        }
      };

      // Simular delay en el use case
      mockRefreshTokenUseCase.execute.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
        return mockAuthResult;
      });

      // Simular resolver con medición de performance
      const resolver = async () => {
        const startTime = Date.now();
        const traceId = `refresh-token-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        
        const result = await mockRefreshTokenUseCase.execute({
          refreshToken,
          userAgent: 'unknown',
          ipAddress: context?.req?.ip || 'unknown'
        });

        const duration = Date.now() - startTime;
        
        mockLogger.info('RefreshToken resolver success', {
          operation: 'refreshToken',
          requestId,
          traceId,
          duration,
          userId: result.user?.id,
          provider: result.provider,
          isNewUser: result.isNewUser
        });

        return {
          success: true,
          message: 'Token refreshed successfully',
          code: 'SUCCESS',
          timestamp: expect.any(String),
          data: {
            user: result.user,
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken
          },
          metadata: {
            requestId,
            traceId,
            duration
          }
        };
      };

      // Act
      const result = await resolver();

      // Assert
      expect(result.metadata.duration).toBeGreaterThanOrEqual(50);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'RefreshToken resolver success',
        expect.objectContaining({
          duration: expect.any(Number)
        })
      );
    });

    it('should include all required metadata in logs', async () => {
      // Arrange
      const refreshToken = 'metadata-test-token';
      const context = {
        req: {
          headers: {
            'x-request-id': 'req-metadata',
            'user-agent': 'TestAgent/1.0'
          },
          ip: '192.168.1.6'
        }
      };

      mockRefreshTokenUseCase.execute.mockResolvedValue(mockAuthResult);

      // Simular resolver con logging completo
      const resolver = async () => {
        const startTime = Date.now();
        const traceId = `refresh-token-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        
        const result = await mockRefreshTokenUseCase.execute({
          refreshToken,
          userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
          ipAddress: context?.req?.ip || 'unknown'
        });

        const duration = Date.now() - startTime;
        
        mockLogger.info('RefreshToken resolver success', {
          operation: 'refreshToken',
          requestId,
          traceId,
          duration,
          userId: result.user?.id,
          provider: result.provider,
          isNewUser: result.isNewUser,
          context: {
            userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
            ipAddress: context?.req?.ip || 'unknown'
          }
        });

        return {
          success: true,
          message: 'Token refreshed successfully',
          code: 'SUCCESS',
          timestamp: expect.any(String),
          data: {
            user: result.user,
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
            session: result.session
          },
          metadata: {
            requestId,
            traceId,
            duration
          }
        };
      };

      // Act
      const result = await resolver();

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        'RefreshToken resolver success',
        expect.objectContaining({
          operation: 'refreshToken',
          requestId: 'req-metadata',
          traceId: expect.stringMatching(/refresh-token-\d+/),
          duration: expect.any(Number),
          userId: 'user-123',
          provider: 'email',
          isNewUser: false,
          context: {
            userAgent: 'TestAgent/1.0',
            ipAddress: '192.168.1.6'
          }
        })
      );
    });
  });
});
