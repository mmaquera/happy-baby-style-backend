import { SessionService, SessionValidationResult, SessionRefreshResult } from '@application/auth/SessionService';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@domain/interfaces/ILogger';
import { ValidationError, UnauthorizedError } from '@domain/errors/DomainError';

describe('SessionService', () => {
  let sessionService: SessionService;
  let mockAuthRepository: jest.Mocked<IAuthRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockAuthRepository = {
      validateSession: jest.fn(),
      refreshUserSession: jest.fn(),
      logoutUser: jest.fn(),
      createSession: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      findSessionByToken: jest.fn(),
      findSessionsByUserId: jest.fn(),
      createUserAccount: jest.fn(),
      findUserAccountByProvider: jest.fn(),
      findUserAccountsByUserId: jest.fn(),
      updateUserAccount: jest.fn(),
      deleteUserAccount: jest.fn(),
      authenticateWithEmail: jest.fn(),
      authenticateWithGoogle: jest.fn(),
      registerWithEmail: jest.fn(),
      findOrCreateUserFromGoogle: jest.fn(),
      updateUserLastLogin: jest.fn(),
      createUserPassword: jest.fn(),
      findUserPasswordByUserId: jest.fn(),
      updateUserPassword: jest.fn(),
      deleteUserPassword: jest.fn(),
      deleteExpiredSessions: jest.fn(),
      invalidateUserSessions: jest.fn(),
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

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn(),
      setTraceId: jest.fn()
    };

    sessionService = new SessionService(mockAuthRepository, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateSession', () => {
    const validSessionToken = 'valid-session-token-123';
    const mockSessionInfo = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'customer',
      provider: 'email' as any,
      isActive: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas en el futuro
      lastLoginAt: new Date()
    };

    it('should validate a valid session successfully', async () => {
      mockAuthRepository.validateSession.mockResolvedValue(mockSessionInfo);

      const result = await sessionService.validateSession(validSessionToken);

      expect(result).toEqual({
        isValid: true,
        sessionId: 'user-123',
        userId: 'user-123',
        expiresAt: mockSessionInfo.expiresAt,
        isActive: true
      });

      expect(mockAuthRepository.validateSession).toHaveBeenCalledWith(validSessionToken);
      expect(mockLogger.info).toHaveBeenCalledWith('Session validation completed', expect.any(Object));
    });

    it('should return invalid for expired session', async () => {
      const expiredSessionInfo = {
        ...mockSessionInfo,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 horas en el pasado
      };
      mockAuthRepository.validateSession.mockResolvedValue(expiredSessionInfo);

      const result = await sessionService.validateSession(validSessionToken);

      expect(result.isValid).toBe(false);
      expect(result.expiresAt).toEqual(expiredSessionInfo.expiresAt);
    });

    it('should return invalid for inactive session', async () => {
      const inactiveSessionInfo = {
        ...mockSessionInfo,
        isActive: false
      };
      mockAuthRepository.validateSession.mockResolvedValue(inactiveSessionInfo);

      const result = await sessionService.validateSession(validSessionToken);

      expect(result.isValid).toBe(false);
      expect(result.isActive).toBe(false);
    });

    it('should throw ValidationError for missing session token', async () => {
      await expect(sessionService.validateSession('')).rejects.toThrow(ValidationError);
      await expect(sessionService.validateSession(null as any)).rejects.toThrow(ValidationError);
    });

    it('should throw UnauthorizedError for invalid session token', async () => {
      mockAuthRepository.validateSession.mockResolvedValue(null);

      await expect(sessionService.validateSession(validSessionToken)).rejects.toThrow(UnauthorizedError);
    });

    it('should handle repository errors gracefully', async () => {
      const repositoryError = new Error('Database connection failed');
      mockAuthRepository.validateSession.mockRejectedValue(repositoryError);

      await expect(sessionService.validateSession(validSessionToken)).rejects.toThrow(repositoryError);
      expect(mockLogger.error).toHaveBeenCalledWith('Session validation failed', repositoryError, expect.any(Object));
    });
  });

  describe('refreshSession', () => {
    const validRefreshToken = 'valid-refresh-token-123';
    const mockAuthResult = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        dateOfBirth: new Date('1990-01-01'),
        avatar: undefined,
        role: 'customer' as any,
        emailVerified: true,
        isActive: true,
        lastLoginAt: new Date(),
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
      provider: 'email' as any
    };

    it('should refresh session successfully', async () => {
      mockAuthRepository.refreshUserSession.mockResolvedValue(mockAuthResult);

      const result = await sessionService.refreshSession(validRefreshToken);

      expect(result).toEqual({
        sessionId: 'user-123',
        userId: 'user-123',
        newAccessToken: 'new-access-token-456',
        newRefreshToken: 'new-refresh-token-789',
        expiresAt: expect.any(Date)
      });

      expect(mockAuthRepository.refreshUserSession).toHaveBeenCalledWith(validRefreshToken);
      expect(mockLogger.info).toHaveBeenCalledWith('Session refresh completed', expect.any(Object));
    });

    it('should throw ValidationError for missing refresh token', async () => {
      await expect(sessionService.refreshSession('')).rejects.toThrow(ValidationError);
      await expect(sessionService.refreshSession(null as any)).rejects.toThrow(ValidationError);
    });

    it('should throw UnauthorizedError for failed refresh', async () => {
      const invalidAuthResult = {
        ...mockAuthResult,
        user: undefined as any
      };
      mockAuthRepository.refreshUserSession.mockResolvedValue(invalidAuthResult);

      await expect(sessionService.refreshSession(validRefreshToken)).rejects.toThrow(UnauthorizedError);
    });

    it('should handle repository errors gracefully', async () => {
      const repositoryError = new Error('Token refresh failed');
      mockAuthRepository.refreshUserSession.mockRejectedValue(repositoryError);

      await expect(sessionService.refreshSession(validRefreshToken)).rejects.toThrow(repositoryError);
      expect(mockLogger.error).toHaveBeenCalledWith('Session refresh failed', repositoryError, expect.any(Object));
    });
  });

  describe('invalidateSession', () => {
    const sessionId = 'session-123';
    const userId = 'user-123';

    it('should invalidate session successfully', async () => {
      mockAuthRepository.logoutUser.mockResolvedValue();

      await sessionService.invalidateSession(sessionId, userId);

      expect(mockAuthRepository.logoutUser).toHaveBeenCalledWith(userId, sessionId);
      expect(mockLogger.info).toHaveBeenCalledWith('Session invalidated successfully', expect.any(Object));
    });

    it('should handle repository errors gracefully', async () => {
      const repositoryError = new Error('Logout failed');
      mockAuthRepository.logoutUser.mockRejectedValue(repositoryError);

      await expect(sessionService.invalidateSession(sessionId, userId)).rejects.toThrow(repositoryError);
      expect(mockLogger.error).toHaveBeenCalledWith('Session invalidation failed', repositoryError, expect.any(Object));
    });
  });

  describe('getSessionInfo', () => {
    const sessionId = 'session-123';

    it('should return null for unimplemented method', async () => {
      const result = await sessionService.getSessionInfo(sessionId);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('getSessionInfo not fully implemented', expect.any(Object));
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Unexpected error');
      mockLogger.warn.mockImplementation(() => { throw error; });

      await expect(sessionService.getSessionInfo(sessionId)).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get session info', error, expect.any(Object));
    });
  });
});
