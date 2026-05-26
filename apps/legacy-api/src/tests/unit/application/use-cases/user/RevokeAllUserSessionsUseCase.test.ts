import { RevokeAllUserSessionsUseCase } from '@application/use-cases/user/RevokeAllUserSessionsUseCase';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@hbs/logging';
import { UserSession } from '@domain/entities/Auth';
import { ValidationError } from '@domain/errors/DomainError';

// Mock repositories and services
const mockAuthRepository: jest.Mocked<IAuthRepository> = {
  findSessionsByUserId: jest.fn(),
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
  findSessionByToken: jest.fn(),
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
  getUserByEmail: jest.fn(),
};

const mockLogger: jest.Mocked<ILogger> = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn(),
  setTraceId: jest.fn(),
};

describe('RevokeAllUserSessionsUseCase', () => {
  let useCase: RevokeAllUserSessionsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new RevokeAllUserSessionsUseCase(mockAuthRepository, mockLogger);
  });

  describe('execute', () => {
    const validRequest = {
      userId: 'user-456',
      requestingUserId: 'user-456',
      reason: 'Security audit',
      excludeCurrentSession: false,
    };

    const mockSessions: UserSession[] = [
      {
        id: 'session-1',
        userId: 'user-456',
        sessionToken: 'token-1',
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        userAgent: 'Mozilla/5.0...',
        ipAddress: '192.168.1.1',
        isActive: true,
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
      },
      {
        id: 'session-2',
        userId: 'user-456',
        sessionToken: 'token-2',
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        userAgent: 'Mozilla/5.0...',
        ipAddress: '192.168.1.2',
        isActive: true,
        createdAt: new Date('2024-01-15T11:00:00Z'),
        updatedAt: new Date('2024-01-15T11:00:00Z'),
      },
      {
        id: 'session-3',
        userId: 'user-456',
        sessionToken: 'token-3',
        accessToken: 'access-3',
        refreshToken: 'refresh-3',
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        userAgent: 'Mozilla/5.0...',
        ipAddress: '192.168.1.3',
        isActive: false, // Already inactive
        createdAt: new Date('2024-01-15T12:00:00Z'),
        updatedAt: new Date('2024-01-15T12:00:00Z'),
      },
    ];

    it('should revoke all active user sessions successfully', async () => {
      // Arrange
      mockAuthRepository.findSessionsByUserId.mockResolvedValue(mockSessions);
      mockAuthRepository.updateSession.mockResolvedValue({ ...mockSessions[0], isActive: false });
      mockAuthRepository.deleteSessionAnalyticsBySessionId.mockResolvedValue();

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expect(result.userId).toBe('user-456');
      expect(result.sessionsRevoked).toBe(2); // Only active sessions
      expect(result.analyticsCleaned).toBe(2);
      expect(result.reason).toBe('Security audit');
      expect(mockAuthRepository.updateSession).toHaveBeenCalledTimes(2);
      expect(mockAuthRepository.deleteSessionAnalyticsBySessionId).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'All user sessions revoked successfully',
        expect.objectContaining({
          userId: 'user-456',
          sessionsRevoked: 2,
          analyticsCleaned: 2,
        }),
      );
    });

    it('should return early when no active sessions exist', async () => {
      // Arrange
      const inactiveSessions = mockSessions.map((s) => ({ ...s, isActive: false }));
      mockAuthRepository.findSessionsByUserId.mockResolvedValue(inactiveSessions);

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expect(result.sessionsRevoked).toBe(0);
      expect(result.analyticsCleaned).toBe(0);
      expect(mockAuthRepository.updateSession).not.toHaveBeenCalled();
      expect(mockAuthRepository.deleteSessionAnalyticsBySessionId).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No active sessions to revoke',
        expect.objectContaining({
          userId: 'user-456',
        }),
      );
    });

    it('should log warning when user attempts to revoke another user sessions', async () => {
      // Arrange
      const requestForOtherUser = { ...validRequest, userId: 'other-user-789' };
      mockAuthRepository.findSessionsByUserId.mockResolvedValue([]);

      // Act
      await useCase.execute(requestForOtherUser);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'User attempting to revoke sessions of another user',
        expect.objectContaining({
          userId: 'other-user-789',
          requestingUserId: 'user-456',
        }),
      );
    });

    it('should continue processing if individual session revocation fails', async () => {
      // Arrange
      mockAuthRepository.findSessionsByUserId.mockResolvedValue(mockSessions);
      mockAuthRepository.updateSession
        .mockResolvedValueOnce({ ...mockSessions[0], isActive: false }) // First session succeeds
        .mockRejectedValueOnce(new Error('Update failed')); // Second session fails
      mockAuthRepository.deleteSessionAnalyticsBySessionId.mockResolvedValue();

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expect(result.sessionsRevoked).toBe(1); // Only one session was revoked
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to revoke individual session',
        expect.any(Error),
        expect.objectContaining({
          sessionId: 'session-2',
          userId: 'user-456',
        }),
      );
    });

    it('should continue processing if analytics cleanup fails', async () => {
      // Arrange
      mockAuthRepository.findSessionsByUserId.mockResolvedValue(mockSessions);
      mockAuthRepository.updateSession.mockResolvedValue({ ...mockSessions[0], isActive: false });
      mockAuthRepository.deleteSessionAnalyticsBySessionId
        .mockResolvedValueOnce() // First analytics cleanup succeeds
        .mockRejectedValueOnce(new Error('Analytics cleanup failed')); // Second fails

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expect(result.sessionsRevoked).toBe(2);
      expect(result.analyticsCleaned).toBe(1); // Only one analytics was cleaned
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to clean session analytics',
        expect.objectContaining({
          sessionId: 'session-2',
          userId: 'user-456',
        }),
      );
    });

    it('should throw ValidationError when userId is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, userId: '' };

      // Act & Assert
      await expect(useCase.execute(invalidRequest)).rejects.toThrow(ValidationError);
      expect(mockAuthRepository.findSessionsByUserId).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when requestingUserId is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, requestingUserId: '' };

      // Act & Assert
      await expect(useCase.execute(invalidRequest)).rejects.toThrow(ValidationError);
      expect(mockAuthRepository.findSessionsByUserId).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when reason is too long', async () => {
      // Arrange
      const longReason = 'a'.repeat(501);
      const invalidRequest = { ...validRequest, reason: longReason };

      // Act & Assert
      await expect(useCase.execute(invalidRequest)).rejects.toThrow(ValidationError);
      expect(mockAuthRepository.findSessionsByUserId).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when excludeCurrentSession is not boolean', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, excludeCurrentSession: 'not-boolean' as any };

      // Act & Assert
      await expect(useCase.execute(invalidRequest)).rejects.toThrow(ValidationError);
      expect(mockAuthRepository.findSessionsByUserId).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const repositoryError = new Error('Database connection failed');
      mockAuthRepository.findSessionsByUserId.mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(useCase.execute(validRequest)).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to revoke all user sessions',
        repositoryError,
        expect.objectContaining({
          userId: 'user-456',
          requestingUserId: 'user-456',
        }),
      );
    });

    it('should work with minimal request (no optional fields)', async () => {
      // Arrange
      const minimalRequest = {
        userId: 'user-456',
        requestingUserId: 'user-456',
      };
      mockAuthRepository.findSessionsByUserId.mockResolvedValue([]);

      // Act
      const result = await useCase.execute(minimalRequest);

      // Assert
      expect(result.userId).toBe('user-456');
      expect(result.sessionsRevoked).toBe(0);
      expect(result.analyticsCleaned).toBe(0);
      expect(result.reason).toBeUndefined();
    });
  });
});
