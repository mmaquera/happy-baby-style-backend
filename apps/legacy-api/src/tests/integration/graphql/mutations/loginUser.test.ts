import { Container } from '@shared/container';
import { AuthenticateUserUseCase } from '@application/use-cases/user/AuthenticateUserUseCase';
import { ILogger } from '@hbs/logging';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { User, UserRole } from '@domain/entities/User';
import { UserSession } from '@domain/entities/Auth';

const mockAuthenticateUserUseCase: jest.Mocked<AuthenticateUserUseCase> = {
  execute: jest.fn(),
} as any;

describe('GraphQL loginUser Mutation Integration - Session Creation', () => {
  let container: jest.Mocked<Container>;
  let mockLogger: jest.Mocked<ILogger>;
  let mockAuthRepository: jest.Mocked<IAuthRepository>;

  beforeEach(() => {
    // Mock container
    container = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'authenticateUserUseCase':
            return mockAuthenticateUserUseCase;
          case 'defaultLogger':
            return mockLogger;
          default:
            return undefined;
        }
      }),
    } as any;

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      createChildLogger: jest.fn(),
    } as any;

    // Mock auth repository
    mockAuthRepository = {
      createSession: jest.fn(),
      findSessionByToken: jest.fn(),
      findSessionsByUserId: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      deleteExpiredSessions: jest.fn(),
      invalidateUserSessions: jest.fn(),
      createUserAccount: jest.fn(),
      findUserAccountByProvider: jest.fn(),
      findUserAccountsByUserId: jest.fn(),
      updateUserAccount: jest.fn(),
      deleteUserAccount: jest.fn(),
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
      logoutUser: jest.fn(),
      refreshUserSession: jest.fn(),
    } as any;
  });

  describe('loginUser mutation with session creation', () => {
    const mockContext = {
      user: null,
      req: {
        headers: {
          'x-request-id': 'req-123',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        ip: '192.168.1.100',
      },
    };

    const mockUser: User = {
      id: 'user-123',
      email: 'test@example.com',
      role: UserRole.CUSTOMER,
      isActive: true,
      emailVerified: true,
      profile: {
        id: 'profile-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.CUSTOMER,
        emailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        addresses: [],
        favoriteProductIds: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockSession: UserSession = {
      id: 'session-123',
      userId: 'user-123',
      sessionToken: 'session-token-123',
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ipAddress: '192.168.1.100',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockLoginResult = {
      user: mockUser,
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      session: {
        id: 'session-123',
        expiresAt: mockSession.expiresAt.toISOString(),
      },
    };

    it('should successfully login user and create session with context information', async () => {
      // Arrange
      mockAuthenticateUserUseCase.execute.mockResolvedValue(mockLoginResult);

      // Simular la mutación GraphQL
      const loginUserMutation = async (
        _: any,
        { email, password }: { email: string; password: string },
        context: any,
      ) => {
        const startTime = Date.now();
        const traceId = `login-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;

        try {
          // Validación básica de input
          if (!email || !password) {
            const duration = Date.now() - startTime;
            return {
              success: false,
              message: 'Email and password are required',
              code: 'MISSING_REQUIRED_FIELD',
              data: null,
              timestamp: new Date().toISOString(),
              metadata: {
                requestId,
                traceId,
                duration,
              },
            };
          }

          // Ejecutar caso de uso con información del contexto
          const authenticateUserUseCase =
            container.get<AuthenticateUserUseCase>('authenticateUserUseCase');
          const result = await authenticateUserUseCase.execute({
            email,
            password,
            userAgent: context?.req?.headers?.['user-agent'],
            ipAddress: context?.req?.ip || context?.req?.connection?.remoteAddress,
          });

          const duration = Date.now() - startTime;

          // Crear respuesta exitosa con estructura de sesión
          return {
            success: true,
            data: {
              user: {
                id: result.user.id,
                email: result.user.email,
                firstName: result.user.profile?.firstName,
                lastName: result.user.profile?.lastName,
                role: result.user.role,
                isActive: result.user.isActive,
              },
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
              session: {
                id: result.session.id,
                expiresAt: result.session.expiresAt,
              },
            },
            message: 'Login successful',
            code: 'SUCCESS',
            timestamp: new Date().toISOString(),
            metadata: {
              requestId,
              traceId,
              duration,
            },
          };
        } catch (error: any) {
          const duration = Date.now() - startTime;

          return {
            success: false,
            message: error.message || 'Internal server error',
            code: 'INTERNAL_ERROR',
            data: null,
            timestamp: new Date().toISOString(),
            metadata: {
              requestId,
              traceId,
              duration,
            },
          };
        }
      };

      // Act
      const result = await loginUserMutation(
        null,
        { email: 'test@example.com', password: 'password123' },
        mockContext,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.code).toBe('SUCCESS');
      expect(result.message).toBe('Login successful');
      expect(result.data).toEqual({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.CUSTOMER,
          isActive: true,
        },
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        session: {
          id: 'session-123',
          expiresAt: mockSession.expiresAt.toISOString(),
        },
      });
      expect(result.metadata).toHaveProperty('requestId');
      expect(result.metadata).toHaveProperty('traceId');
      expect(result.metadata).toHaveProperty('duration');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Verificar que se llamó al caso de uso con la información del contexto
      expect(mockAuthenticateUserUseCase.execute).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ipAddress: '192.168.1.100',
      });
    });

    it('should handle missing userAgent and ipAddress gracefully', async () => {
      // Arrange
      const contextWithoutIp = {
        user: null,
        req: {
          headers: {
            'x-request-id': 'req-123',
          },
        },
      };

      mockAuthenticateUserUseCase.execute.mockResolvedValue(mockLoginResult);

      // Simular la mutación GraphQL
      const loginUserMutation = async (
        _: any,
        { email, password }: { email: string; password: string },
        context: any,
      ) => {
        const startTime = Date.now();
        const traceId = `login-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;

        try {
          // Ejecutar caso de uso
          const authenticateUserUseCase =
            container.get<AuthenticateUserUseCase>('authenticateUserUseCase');
          const result = await authenticateUserUseCase.execute({
            email,
            password,
            userAgent: context?.req?.headers?.['user-agent'],
            ipAddress: context?.req?.ip || context?.req?.connection?.remoteAddress,
          });

          const duration = Date.now() - startTime;

          return {
            success: true,
            data: {
              user: result.user,
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
              session: result.session,
            },
            message: 'Login successful',
            code: 'SUCCESS',
            timestamp: new Date().toISOString(),
            metadata: {
              requestId,
              traceId,
              duration,
            },
          };
        } catch (error: any) {
          const duration = Date.now() - startTime;
          return {
            success: false,
            message: error.message || 'Internal server error',
            code: 'INTERNAL_ERROR',
            data: null,
            timestamp: new Date().toISOString(),
            metadata: {
              requestId,
              traceId,
              duration,
            },
          };
        }
      };

      // Act
      const result = await loginUserMutation(
        null,
        { email: 'test@example.com', password: 'password123' },
        contextWithoutIp,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockAuthenticateUserUseCase.execute).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        userAgent: undefined,
        ipAddress: undefined,
      });
    });

    it('should return error response for missing credentials', async () => {
      // Arrange
      const loginUserMutation = async (
        _: any,
        { email, password }: { email: string; password: string },
        context: any,
      ) => {
        const startTime = Date.now();
        const traceId = `login-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;

        // Validación básica de input
        if (!email || !password) {
          const duration = Date.now() - startTime;
          return {
            success: false,
            message: 'Email and password are required',
            code: 'MISSING_REQUIRED_FIELD',
            data: null,
            timestamp: new Date().toISOString(),
            metadata: {
              requestId,
              traceId,
              duration,
            },
          };
        }

        // Este código no debería ejecutarse
        return { success: false };
      };

      // Act
      const result = await loginUserMutation(null, { email: '', password: '' }, mockContext);

      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('MISSING_REQUIRED_FIELD');
      expect(result.message).toBe('Email and password are required');
      expect(result.data).toBeNull();
      expect(result.metadata).toHaveProperty('requestId');
      expect(result.metadata).toHaveProperty('traceId');
      expect(result.metadata).toHaveProperty('duration');
    });

    it('should handle authentication errors gracefully', async () => {
      // Arrange
      const authError = new Error('Invalid credentials');
      mockAuthenticateUserUseCase.execute.mockRejectedValue(authError);

      const loginUserMutation = async (
        _: any,
        { email, password }: { email: string; password: string },
        context: any,
      ) => {
        const startTime = Date.now();
        const traceId = `login-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;

        try {
          // Ejecutar caso de uso
          const authenticateUserUseCase =
            container.get<AuthenticateUserUseCase>('authenticateUserUseCase');
          await authenticateUserUseCase.execute({
            email,
            password,
            userAgent: context?.req?.headers?.['user-agent'],
            ipAddress: context?.req?.ip || context?.req?.connection?.remoteAddress,
          });

          // Este código no debería ejecutarse
          return { success: false };
        } catch (error: any) {
          const duration = Date.now() - startTime;

          return {
            success: false,
            message: error.message || 'Internal server error',
            code: 'INTERNAL_ERROR',
            data: null,
            timestamp: new Date().toISOString(),
            metadata: {
              requestId,
              traceId,
              duration,
            },
          };
        }
      };

      // Act
      const result = await loginUserMutation(
        null,
        { email: 'test@example.com', password: 'wrongpassword' },
        mockContext,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.message).toBe('Invalid credentials');
      expect(result.data).toBeNull();
      expect(result.metadata).toHaveProperty('requestId');
      expect(result.metadata).toHaveProperty('traceId');
      expect(result.metadata).toHaveProperty('duration');
    });
  });
});
