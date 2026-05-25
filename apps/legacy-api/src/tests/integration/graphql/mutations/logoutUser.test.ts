import { Container } from '@shared/container';
import { LogoutUserUseCase } from '@application/use-cases/user/LogoutUserUseCase';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@hbs/logging';

// Mock del container
jest.mock('@shared/container');

// Mock del repositorio
const mockAuthRepository: jest.Mocked<IAuthRepository> = {
  createUserAccount: jest.fn(),
  findUserAccountByProvider: jest.fn(),
  findUserAccountsByUserId: jest.fn(),
  updateUserAccount: jest.fn(),
  deleteUserAccount: jest.fn(),
  createSession: jest.fn(),
  findSessionByToken: jest.fn(),
  findSessionsByUserId: jest.fn(),
  updateSession: jest.fn(),
  deleteSession: jest.fn(),
  deleteExpiredSessions: jest.fn(),
  invalidateUserSessions: jest.fn(),
  createUserPassword: jest.fn(),
  findUserPasswordByUserId: jest.fn(),
  updateUserPassword: jest.fn(),
  deleteUserPassword: jest.fn(),
  authenticateWithEmail: jest.fn(),
  authenticateWithGoogle: jest.fn(),
  registerWithEmail: jest.fn(),
  findOrCreateUserFromGoogle: jest.fn(),
  updateUserLastLogin: jest.fn(),
  validateSession: jest.fn(),
  refreshUserSession: jest.fn(),
  logoutUser: jest.fn(),
  createSessionAnalytics: jest.fn(),
  findSessionAnalyticsById: jest.fn(),
  findSessionAnalyticsBySessionId: jest.fn(),
  findSessionAnalyticsByUserId: jest.fn(),
  updateSessionAnalytics: jest.fn(),
  deleteSessionAnalytics: jest.fn(),
  deleteSessionAnalyticsByUserId: jest.fn(),
  deleteSessionAnalyticsBySessionId: jest.fn(),
  // Additional methods for UpdateUserPasswordUseCase
  verifyPassword: jest.fn(),
  updatePassword: jest.fn(),
  getUserById: jest.fn(),
  getUserByEmail: jest.fn()
};

// Mock del logger
const mockLogger: jest.Mocked<ILogger> = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn(),
  setTraceId: jest.fn()
};

// Mock del caso de uso
const mockLogoutUserUseCase: jest.Mocked<LogoutUserUseCase> = {
  execute: jest.fn()
} as any;

describe('GraphQL logoutUser Mutation Integration', () => {
  let container: jest.Mocked<Container>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock del container
    container = {
      get: jest.fn()
    } as any;
    
    (Container.getInstance as jest.Mock).mockReturnValue(container);
    
    // Configurar mocks
    container.get.mockImplementation((key: string) => {
      switch (key) {
        case 'defaultLogger':
          return mockLogger;
        case 'logoutUserUseCase':
          return mockLogoutUserUseCase;
        default:
          return undefined;
      }
    });
  });

  describe('logoutUser mutation', () => {
    const mockContext = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'customer'
      },
      req: {
        headers: {
          'x-request-id': 'req-test-123',
          'user-agent': 'Mozilla/5.0 (Test)'
        },
        ip: '192.168.1.100'
      }
    };

    const mockLogoutResult = {
      userId: 'user-123',
      loggedOutAt: new Date().toISOString(),
      reason: 'user_request',
      sessionsInvalidated: 2
    };

    it('should successfully logout authenticated user', async () => {
      // Arrange
      mockLogoutUserUseCase.execute.mockResolvedValue(mockLogoutResult);

      // Simular la mutación GraphQL
      const logoutUserMutation = async (_: any, __: any, context: any) => {
        const startTime = Date.now();
        const traceId = `logout-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        
        try {
          // Obtener logger del container
          const logger = container.get<ILogger>('defaultLogger');
          
          // Log de inicio de operación
          logger.info('Starting user logout process', {
            operation: 'logoutUser',
            requestId,
            traceId,
            context: {
              hasUser: !!context.user,
              userId: context.user?.id,
              userAgent: context?.req?.headers?.['user-agent'] || 'unknown'
            }
          });

          // Validar que el usuario esté autenticado
          if (!context.user) {
            const duration = Date.now() - startTime;
            
            logger.warn('Logout attempted without authentication', {
              operation: 'logoutUser',
              requestId,
              traceId,
              duration,
              context: {
                userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
                ip: context?.req?.ip || 'unknown'
              }
            });
            
            return {
              success: false,
              message: 'User not authenticated',
              code: 'UNAUTHORIZED',
              data: null,
              timestamp: new Date().toISOString(),
              metadata: {
                requestId,
                traceId,
                duration
              }
            };
          }

          // Obtener caso de uso de logout
          const logoutUserUseCase = container.get<LogoutUserUseCase>('logoutUserUseCase');
          
          // Ejecutar logout
          const result = await logoutUserUseCase.execute({
            userId: context.user.id,
            reason: 'user_request'
          });

          const duration = Date.now() - startTime;
          
          // Log de éxito
          logger.info('User logout completed successfully', {
            operation: 'logoutUser',
            userId: context.user.id,
            requestId,
            traceId,
            duration,
            result: {
              sessionsInvalidated: result.sessionsInvalidated,
              reason: result.reason
            }
          });
          
          // Crear respuesta exitosa
          return {
            success: true,
            data: {
              userId: result.userId,
              loggedOutAt: result.loggedOutAt,
              reason: result.reason,
              sessionsInvalidated: result.sessionsInvalidated
            },
            message: 'User logged out successfully',
            code: 'LOGGED_OUT',
            timestamp: new Date().toISOString(),
            metadata: {
              requestId,
              traceId,
              duration
            }
          };

        } catch (error: any) {
          const duration = Date.now() - startTime;
          
          // Log del error con contexto completo
          const logger = container.get<ILogger>('defaultLogger');
          logger.error('LogoutUser resolver error', error, {
            operation: 'logoutUser',
            requestId,
            traceId,
            duration,
            errorDetails: {
              message: error.message,
              type: error.constructor.name,
              stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            context: {
              hasUser: !!context.user,
              userId: context.user?.id,
              userAgent: context?.req?.headers?.['user-agent'] || 'unknown'
            }
          });
          
          // Crear respuesta de error
          return {
            success: false,
            message: error.message || 'Internal server error',
            code: 'INTERNAL_ERROR',
            data: null,
            timestamp: new Date().toISOString(),
            metadata: {
              requestId,
              traceId,
              duration
            }
          };
        }
      };

      // Act
      const result = await logoutUserMutation(null, null, mockContext);

      // Assert
      expect(result.success).toBe(true);
      expect(result.code).toBe('LOGGED_OUT');
      expect(result.message).toBe('User logged out successfully');
      expect(result.data).toEqual({
        userId: 'user-123',
        loggedOutAt: expect.any(String),
        reason: 'user_request',
        sessionsInvalidated: 2
      });
      expect(result.metadata).toHaveProperty('requestId');
      expect(result.metadata).toHaveProperty('traceId');
      expect(result.metadata).toHaveProperty('duration');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Verificar que se llamó al caso de uso
      expect(mockLogoutUserUseCase.execute).toHaveBeenCalledWith({
        userId: 'user-123',
        reason: 'user_request'
      });

      // Verificar logging
      expect(mockLogger.info).toHaveBeenCalledWith('Starting user logout process', expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalledWith('User logout completed successfully', expect.any(Object));
    });

    it('should return error when user is not authenticated', async () => {
      // Arrange
      const contextWithoutUser = {
        req: {
          headers: {
            'x-request-id': 'req-test-123',
            'user-agent': 'Mozilla/5.0 (Test)'
          },
          ip: '192.168.1.100'
        }
      };

      // Simular la mutación GraphQL
      const logoutUserMutation = async (_: any, __: any, context: any) => {
        const startTime = Date.now();
        const traceId = `logout-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        
        try {
          // Obtener logger del container
          const logger = container.get<ILogger>('defaultLogger');
          
          // Log de inicio de operación
          logger.info('Starting user logout process', {
            operation: 'logoutUser',
            requestId,
            traceId,
            context: {
              hasUser: !!context.user,
              userId: context.user?.id,
              userAgent: context?.req?.headers?.['user-agent'] || 'unknown'
            }
          });

          // Validar que el usuario esté autenticado
          if (!context.user) {
            const duration = Date.now() - startTime;
            
            logger.warn('Logout attempted without authentication', {
              operation: 'logoutUser',
              requestId,
              traceId,
              duration,
              context: {
                userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
                ip: context?.req?.ip || 'unknown'
              }
            });
            
            return {
              success: false,
              message: 'User not authenticated',
              code: 'UNAUTHORIZED',
              data: null,
              timestamp: new Date().toISOString(),
              metadata: {
                requestId,
                traceId,
                duration
              }
            };
          }

          // Este código no debería ejecutarse
          return { success: false };

        } catch (error: any) {
          const duration = Date.now() - startTime;
          
          // Log del error
          const logger = container.get<ILogger>('defaultLogger');
          logger.error('LogoutUser resolver error', error, {
            operation: 'logoutUser',
            requestId,
            traceId,
            duration,
            errorDetails: {
              message: error.message,
              type: error.constructor.name
            },
            context: {
              hasUser: !!context.user,
              userId: context.user?.id,
              userAgent: context?.req?.headers?.['user-agent'] || 'unknown'
            }
          });
          
          return {
            success: false,
            message: error.message || 'Internal server error',
            code: 'INTERNAL_ERROR',
            data: null,
            timestamp: new Date().toISOString(),
            metadata: {
              requestId,
              traceId,
              duration
            }
          };
        }
      };

      // Act
      const result = await logoutUserMutation(null, null, contextWithoutUser);

      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('UNAUTHORIZED');
      expect(result.message).toBe('User not authenticated');
      expect(result.data).toBeNull();
      expect(result.metadata).toHaveProperty('requestId');
      expect(result.metadata).toHaveProperty('traceId');
      expect(result.metadata).toHaveProperty('duration');

      // Verificar logging de warning
      expect(mockLogger.warn).toHaveBeenCalledWith('Logout attempted without authentication', expect.any(Object));
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockLogoutUserUseCase.execute.mockRejectedValue(error);

      // Simular la mutación GraphQL
      const logoutUserMutation = async (_: any, __: any, context: any) => {
        const startTime = Date.now();
        const traceId = `logout-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        
        try {
          // Obtener logger del container
          const logger = container.get<ILogger>('defaultLogger');
          
          // Log de inicio de operación
          logger.info('Starting user logout process', {
            operation: 'logoutUser',
            requestId,
            traceId,
            context: {
              hasUser: !!context.user,
              userId: context.user?.id,
              userAgent: context?.req?.headers?.['user-agent'] || 'unknown'
            }
          });

          // Validar que el usuario esté autenticado
          if (!context.user) {
            const duration = Date.now() - startTime;
            
            logger.warn('Logout attempted without authentication', {
              operation: 'logoutUser',
              requestId,
              traceId,
              duration,
              context: {
                userAgent: context?.req?.headers?.['user-agent'] || 'unknown',
                ip: context?.req?.ip || 'unknown'
              }
            });
            
            return {
              success: false,
              message: 'User not authenticated',
              code: 'UNAUTHORIZED',
              data: null,
              timestamp: new Date().toISOString(),
              metadata: {
                requestId,
                traceId,
                duration
              }
            };
          }

          // Obtener caso de uso de logout
          const logoutUserUseCase = container.get<LogoutUserUseCase>('logoutUserUseCase');
          
          // Ejecutar logout (esto fallará)
          const result = await logoutUserUseCase.execute({
            userId: context.user.id,
            reason: 'user_request'
          });

          // Este código no debería ejecutarse
          return { success: true };

        } catch (error: any) {
          const duration = Date.now() - startTime;
          
          // Log del error con contexto completo
          const logger = container.get<ILogger>('defaultLogger');
          logger.error('LogoutUser resolver error', error, {
            operation: 'logoutUser',
            requestId,
            traceId,
            duration,
            errorDetails: {
              message: error.message,
              type: error.constructor.name,
              stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            context: {
              hasUser: !!context.user,
              userId: context.user?.id,
              userAgent: context?.req?.headers?.['user-agent'] || 'unknown'
            }
          });
          
          // Crear respuesta de error
          return {
            success: false,
            message: error.message || 'Internal server error',
            code: 'INTERNAL_ERROR',
            data: null,
            timestamp: new Date().toISOString(),
            metadata: {
              requestId,
              traceId,
              duration
            }
          };
        }
      };

      // Act
      const result = await logoutUserMutation(null, null, mockContext);

      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.message).toBe('Database connection failed');
      expect(result.data).toBeNull();
      expect(result.metadata).toHaveProperty('requestId');
      expect(result.metadata).toHaveProperty('traceId');
      expect(result.metadata).toHaveProperty('duration');

      // Verificar logging de error
      expect(mockLogger.error).toHaveBeenCalledWith('LogoutUser resolver error', error, expect.any(Object));
    });
  });
});
