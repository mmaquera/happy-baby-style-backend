import { RefreshTokenUseCase, RefreshTokenRequest, RefreshTokenResponse } from '@application/use-cases/user/RefreshTokenUseCase';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@hbs/logging';
import { AuthResult, AuthProvider } from '@domain/entities/Auth';
import { UserRole } from '@domain/entities/User';
import { ValidationError, NotFoundError, UnauthorizedError, InfrastructureError, BusinessLogicError } from '@domain/errors/DomainError';

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
      createSessionAnalytics: jest.fn(),
      findSessionAnalyticsById: jest.fn(),
      findSessionAnalyticsBySessionId: jest.fn(),
      findSessionAnalyticsByUserId: jest.fn(),
      updateSessionAnalytics: jest.fn(),
      deleteSessionAnalytics: jest.fn(),
      deleteSessionAnalyticsByUserId: jest.fn(),
      deleteSessionAnalyticsBySessionId: jest.fn(),
  validateSession: jest.fn(),
  refreshUserSession: jest.fn(),
  logoutUser: jest.fn(),
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

describe('RefreshTokenUseCase', () => {
  let refreshTokenUseCase: RefreshTokenUseCase;
  let mockAuthRepo: jest.Mocked<IAuthRepository>;
  let mockLoggerInstance: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockAuthRepo = { ...mockAuthRepository };
    mockLoggerInstance = { ...mockLogger };
    refreshTokenUseCase = new RefreshTokenUseCase(mockAuthRepo, mockLoggerInstance);
    
    // Limpiar todos los mocks
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validRequest: RefreshTokenRequest = {
      refreshToken: 'valid-refresh-token-123',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      ipAddress: '192.168.1.1'
    };

    const mockAuthResult: AuthResult = {
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
        refreshToken: 'new-refresh-token-789',
        expiresIn: 3600,
        tokenType: 'Bearer'
      },
      isNewUser: false,
      provider: AuthProvider.EMAIL
    };

    it('should successfully refresh a valid token', async () => {
      // Arrange
      mockAuthRepo.refreshUserSession.mockResolvedValue(mockAuthResult);

      // Act
      const result = await refreshTokenUseCase.execute(validRequest);

      // Assert
      expect(result).toEqual({
        user: mockAuthResult.user,
        tokens: {
          accessToken: mockAuthResult.tokens.accessToken,
          refreshToken: mockAuthResult.tokens.refreshToken
        },
        isNewUser: mockAuthResult.isNewUser,
        provider: mockAuthResult.provider
      });

      expect(mockAuthRepo.refreshUserSession).toHaveBeenCalledWith(validRequest.refreshToken);
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        'Starting token refresh process',
        expect.objectContaining({
          refreshToken: '[REDACTED]',
          userAgent: validRequest.userAgent,
          ipAddress: validRequest.ipAddress
        })
      );
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        'Token refresh completed successfully',
        expect.objectContaining({
          userId: mockAuthResult.user.id,
          provider: mockAuthResult.provider,
          isNewUser: mockAuthResult.isNewUser
        })
      );
    });

    it('should throw ValidationError when refresh token is empty', async () => {
      // Arrange
      const invalidRequest: RefreshTokenRequest = {
        refreshToken: '',
        userAgent: 'Test Browser',
        ipAddress: '192.168.1.1'
      };

      // Act & Assert
      await expect(refreshTokenUseCase.execute(invalidRequest)).rejects.toThrow(
        ValidationError
      );

      expect(mockAuthRepo.refreshUserSession).not.toHaveBeenCalled();
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Token refresh failed',
        expect.any(ValidationError),
        expect.objectContaining({
          refreshToken: '[REDACTED]',
          userAgent: invalidRequest.userAgent,
          ipAddress: invalidRequest.ipAddress,
          errorType: 'ValidationError'
        })
      );
    });

    it('should throw ValidationError when refresh token is only whitespace', async () => {
      // Arrange
      const invalidRequest: RefreshTokenRequest = {
        refreshToken: '   ',
        userAgent: 'Test Browser',
        ipAddress: '192.168.1.1'
      };

      // Act & Assert
      await expect(refreshTokenUseCase.execute(invalidRequest)).rejects.toThrow(
        ValidationError
      );

      expect(mockAuthRepo.refreshUserSession).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when refresh token is null', async () => {
      // Arrange
      const invalidRequest: RefreshTokenRequest = {
        refreshToken: null as any,
        userAgent: 'Test Browser',
        ipAddress: '192.168.1.1'
      };

      // Act & Assert
      await expect(refreshTokenUseCase.execute(invalidRequest)).rejects.toThrow(
        ValidationError
      );

      expect(mockAuthRepo.refreshUserSession).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when auth repository throws not found error', async () => {
      // Arrange
      const notFoundError = new NotFoundError('User session', 'refresh-token-123');
      mockAuthRepo.refreshUserSession.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(refreshTokenUseCase.execute(validRequest)).rejects.toThrow(
        NotFoundError
      );

      expect(mockAuthRepo.refreshUserSession).toHaveBeenCalledWith(validRequest.refreshToken);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Token refresh failed',
        notFoundError,
        expect.objectContaining({
          refreshToken: '[REDACTED]',
          userAgent: validRequest.userAgent,
          ipAddress: validRequest.ipAddress,
          errorType: 'NotFoundError'
        })
      );
    });

    it('should throw UnauthorizedError when repository throws "Invalid or expired" error', async () => {
      // Arrange
      const repositoryError = new Error('Invalid or expired refresh token');
      mockAuthRepo.refreshUserSession.mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(refreshTokenUseCase.execute(validRequest)).rejects.toThrow(
        UnauthorizedError
      );

      expect(mockAuthRepo.refreshUserSession).toHaveBeenCalledWith(validRequest.refreshToken);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Token refresh failed',
        repositoryError,
        expect.objectContaining({
          refreshToken: '[REDACTED]',
          userAgent: validRequest.userAgent,
          ipAddress: validRequest.ipAddress,
          errorType: 'Error'
        })
      );
    });

    it('should throw NotFoundError when repository throws "User not found" error', async () => {
      // Arrange
      const repositoryError = new Error('User not found');
      mockAuthRepo.refreshUserSession.mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(refreshTokenUseCase.execute(validRequest)).rejects.toThrow(
        NotFoundError
      );

      expect(mockAuthRepo.refreshUserSession).toHaveBeenCalledWith(validRequest.refreshToken);
    });

    it('should throw InfrastructureError for other repository errors', async () => {
      // Arrange
      const repositoryError = new Error('Database connection failed');
      mockAuthRepo.refreshUserSession.mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(refreshTokenUseCase.execute(validRequest)).rejects.toThrow(
        InfrastructureError
      );

      expect(mockAuthRepo.refreshUserSession).toHaveBeenCalledWith(validRequest.refreshToken);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Token refresh failed',
        repositoryError,
        expect.objectContaining({
          refreshToken: '[REDACTED]',
          userAgent: validRequest.userAgent,
          ipAddress: validRequest.ipAddress,
          errorType: 'Error'
        })
      );
    });

    it('should re-throw DomainError instances without modification', async () => {
      // Arrange
      const domainError = new BusinessLogicError('Business rule violation');
      mockAuthRepo.refreshUserSession.mockRejectedValue(domainError);

      // Act & Assert
      await expect(refreshTokenUseCase.execute(validRequest)).rejects.toThrow(
        InfrastructureError
      );

      expect(mockAuthRepo.refreshUserSession).toHaveBeenCalledWith(validRequest.refreshToken);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Token refresh failed',
        domainError,
        expect.objectContaining({
          refreshToken: '[REDACTED]',
          userAgent: validRequest.userAgent,
          ipAddress: validRequest.ipAddress,
          errorType: 'BusinessLogicError'
        })
      );
    });

    it('should handle request without optional fields', async () => {
      // Arrange
      const minimalRequest: RefreshTokenRequest = {
        refreshToken: 'minimal-token'
      };
      mockAuthRepo.refreshUserSession.mockResolvedValue(mockAuthResult);

      // Act
      const result = await refreshTokenUseCase.execute(minimalRequest);

      // Assert
      expect(result).toBeDefined();
      expect(mockAuthRepo.refreshUserSession).toHaveBeenCalledWith('minimal-token');
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        'Starting token refresh process',
        expect.objectContaining({
          refreshToken: '[REDACTED]',
          userAgent: undefined,
          ipAddress: undefined
        })
      );
    });

    it('should handle unknown error types gracefully', async () => {
      // Arrange
      const unknownError = 'Unknown error string';
      mockAuthRepo.refreshUserSession.mockRejectedValue(unknownError);

      // Act & Assert
      await expect(refreshTokenUseCase.execute(validRequest)).rejects.toThrow(
        InfrastructureError
      );

      expect(mockAuthRepo.refreshUserSession).toHaveBeenCalledWith(validRequest.refreshToken);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Token refresh failed',
        unknownError,
        expect.objectContaining({
          refreshToken: '[REDACTED]',
          userAgent: validRequest.userAgent,
          ipAddress: validRequest.ipAddress,
          errorType: 'Unknown'
        })
      );
    });
  });
});
