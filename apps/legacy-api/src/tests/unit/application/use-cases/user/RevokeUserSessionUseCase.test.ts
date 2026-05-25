import { RevokeUserSessionUseCase } from '@application/use-cases/user/RevokeUserSessionUseCase';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@hbs/logging';
import { UserSession } from '@domain/entities/Auth';
import { ValidationError, NotFoundError, UnauthorizedError } from '@domain/errors/DomainError';

// Mock repositories and services
const mockAuthRepository: jest.Mocked<IAuthRepository> = {
  findSessionByToken: jest.fn(),
  updateSession: jest.fn(),
  deleteSessionAnalyticsBySessionId: jest.fn(),
  createSessionAnalytics: jest.fn(),
  findSessionAnalyticsBySessionId: jest.fn(),
  findSessionAnalyticsById: jest.fn(),
  findSessionAnalyticsByUserId: jest.fn(),
  updateSessionAnalytics: jest.fn(),
  deleteSessionAnalytics: jest.fn(),
  deleteSessionAnalyticsByUserId: jest.fn(),
  createUserAccount: jest.fn(),
  findUserAccountByProvider: jest.fn(),
  findUserAccountsByUserId: jest.fn(),
  updateUserAccount: jest.fn(),
  deleteUserAccount: jest.fn(),
  createSession: jest.fn(),
  findSessionsByUserId: jest.fn(),
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
  // Additional methods for UpdateUserPasswordUseCase
  verifyPassword: jest.fn(),
  updatePassword: jest.fn(),
  getUserById: jest.fn(),
  getUserByEmail: jest.fn()
};

const mockLogger: jest.Mocked<ILogger> = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn(),
  setTraceId: jest.fn()
};

describe('RevokeUserSessionUseCase', () => {
  let useCase: RevokeUserSessionUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new RevokeUserSessionUseCase(mockAuthRepository, mockLogger);
  });

  describe('execute', () => {
    const validRequest = {
      sessionId: 'session-123',
      userId: 'user-456',
      reason: 'Security concern'
    };

    const mockSession: UserSession = {
      id: 'session-123',
      userId: 'user-456',
      sessionToken: 'token-123',
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
      expiresAt: new Date('2024-12-31T23:59:59Z'),
      userAgent: 'Mozilla/5.0...',
      ipAddress: '192.168.1.1',
      isActive: true,
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:00:00Z')
    };

    it('should revoke user session successfully', async () => {
      // Arrange
      mockAuthRepository.findSessionByToken.mockResolvedValue(mockSession);
      mockAuthRepository.updateSession.mockResolvedValue({ ...mockSession, isActive: false });
      mockAuthRepository.deleteSessionAnalyticsBySessionId.mockResolvedValue();

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expect(result.sessionId).toBe('session-123');
      expect(result.reason).toBe('Security concern');
      expect(result.analyticsCleaned).toBe(true);
      expect(mockAuthRepository.updateSession).toHaveBeenCalledWith('session-123', {
        isActive: false,
        expiresAt: expect.any(Date)
      });
      expect(mockAuthRepository.deleteSessionAnalyticsBySessionId).toHaveBeenCalledWith('session-123');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User session revoked successfully',
        expect.objectContaining({
          sessionId: 'session-123',
          userId: 'user-456'
        })
      );
    });

    it('should return early if session is already inactive', async () => {
      // Arrange
      const inactiveSession = { ...mockSession, isActive: false };
      mockAuthRepository.findSessionByToken.mockResolvedValue(inactiveSession);

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expect(result.analyticsCleaned).toBe(false);
      expect(mockAuthRepository.updateSession).not.toHaveBeenCalled();
      expect(mockAuthRepository.deleteSessionAnalyticsBySessionId).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Session already inactive, no action needed',
        expect.objectContaining({
          sessionId: 'session-123',
          userId: 'user-456'
        })
      );
    });

    it('should throw NotFoundError when session does not exist', async () => {
      // Arrange
      mockAuthRepository.findSessionByToken.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(validRequest)).rejects.toThrow(NotFoundError);
      expect(mockAuthRepository.updateSession).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedError when user tries to revoke another user session', async () => {
      // Arrange
      const otherUserSession = { ...mockSession, userId: 'other-user-789' };
      mockAuthRepository.findSessionByToken.mockResolvedValue(otherUserSession);

      // Act & Assert
      await expect(useCase.execute(validRequest)).rejects.toThrow(UnauthorizedError);
      expect(mockAuthRepository.updateSession).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unauthorized session revocation attempt',
        expect.objectContaining({
          sessionId: 'session-123',
          sessionUserId: 'other-user-789',
          requestingUserId: 'user-456'
        })
      );
    });

    it('should continue if analytics cleanup fails', async () => {
      // Arrange
      mockAuthRepository.findSessionByToken.mockResolvedValue(mockSession);
      mockAuthRepository.updateSession.mockResolvedValue({ ...mockSession, isActive: false });
      mockAuthRepository.deleteSessionAnalyticsBySessionId.mockRejectedValue(new Error('Analytics cleanup failed'));

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expect(result.analyticsCleaned).toBe(false);
      expect(mockAuthRepository.updateSession).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to clean session analytics',
        expect.objectContaining({
          sessionId: 'session-123',
          userId: 'user-456'
        })
      );
    });

    it('should throw ValidationError when sessionId is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, sessionId: '' };

      // Act & Assert
      await expect(useCase.execute(invalidRequest)).rejects.toThrow(ValidationError);
      expect(mockAuthRepository.findSessionByToken).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when userId is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, userId: '' };

      // Act & Assert
      await expect(useCase.execute(invalidRequest)).rejects.toThrow(ValidationError);
      expect(mockAuthRepository.findSessionByToken).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when reason is too long', async () => {
      // Arrange
      const longReason = 'a'.repeat(501);
      const invalidRequest = { ...validRequest, reason: longReason };

      // Act & Assert
      await expect(useCase.execute(invalidRequest)).rejects.toThrow(ValidationError);
      expect(mockAuthRepository.findSessionByToken).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const repositoryError = new Error('Database connection failed');
      mockAuthRepository.findSessionByToken.mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(useCase.execute(validRequest)).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to revoke user session',
        repositoryError,
        expect.objectContaining({
          sessionId: 'session-123',
          userId: 'user-456'
        })
      );
    });
  });
});
