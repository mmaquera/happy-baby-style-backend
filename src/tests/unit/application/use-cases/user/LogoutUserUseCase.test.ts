import { LogoutUserUseCase, LogoutUserRequest, LogoutUserResponse } from '@application/use-cases/user/LogoutUserUseCase';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@domain/interfaces/ILogger';
import { UserSession } from '@domain/entities/Auth';

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
  logoutUser: jest.fn()
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

describe('LogoutUserUseCase', () => {
  let logoutUserUseCase: LogoutUserUseCase;
  let mockSessions: UserSession[];

  beforeEach(() => {
    jest.clearAllMocks();
    
    logoutUserUseCase = new LogoutUserUseCase(mockAuthRepository, mockLogger);
    
    // Mock de sesiones de usuario
    mockSessions = [
      {
        id: 'session-1',
        userId: 'user-123',
        sessionToken: 'token-1',
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'session-2',
        userId: 'user-123',
        sessionToken: 'token-2',
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.2',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  });

  describe('execute', () => {
    const validRequest: LogoutUserRequest = {
      userId: 'user-123',
      reason: 'user_request'
    };

    it('should successfully logout user and invalidate all sessions', async () => {
      // Arrange
      mockAuthRepository.invalidateUserSessions.mockResolvedValue();
      mockAuthRepository.findSessionsByUserId.mockResolvedValue(mockSessions);

      // Act
      const result = await logoutUserUseCase.execute(validRequest);

      // Assert
      expect(mockAuthRepository.invalidateUserSessions).toHaveBeenCalledWith('user-123');
      expect(mockAuthRepository.findSessionsByUserId).toHaveBeenCalledWith('user-123');
      expect(mockLogger.info).toHaveBeenCalledWith('Starting user logout process', {
        userId: 'user-123',
        sessionId: undefined,
        reason: 'user_request'
      });
      expect(mockLogger.info).toHaveBeenCalledWith('User logout completed successfully', {
        userId: 'user-123',
        sessionsInvalidated: 2,
        reason: 'user_request'
      });

      expect(result).toEqual({
        userId: 'user-123',
        sessionId: undefined,
        loggedOutAt: expect.any(String),
        reason: 'user_request',
        sessionsInvalidated: 2
      });
    });

    it('should logout user with specific session ID', async () => {
      // Arrange
      const requestWithSession: LogoutUserRequest = {
        userId: 'user-123',
        sessionId: 'session-1',
        reason: 'admin_force'
      };
      
      mockAuthRepository.invalidateUserSessions.mockResolvedValue();
      mockAuthRepository.deleteSession.mockResolvedValue();
      mockAuthRepository.findSessionsByUserId.mockResolvedValue(mockSessions);

      // Act
      const result = await logoutUserUseCase.execute(requestWithSession);

      // Assert
      expect(mockAuthRepository.invalidateUserSessions).toHaveBeenCalledWith('user-123');
      expect(mockAuthRepository.deleteSession).toHaveBeenCalledWith('session-1');
      expect(result.sessionId).toBe('session-1');
      expect(result.reason).toBe('admin_force');
    });

    it('should use default reason when none provided', async () => {
      // Arrange
      const requestWithoutReason: LogoutUserRequest = {
        userId: 'user-123'
      };
      
      mockAuthRepository.invalidateUserSessions.mockResolvedValue();
      mockAuthRepository.findSessionsByUserId.mockResolvedValue(mockSessions);

      // Act
      const result = await logoutUserUseCase.execute(requestWithoutReason);

      // Assert
      expect(result.reason).toBe('user_request');
    });

    it('should handle case when user has no active sessions', async () => {
      // Arrange
      mockAuthRepository.invalidateUserSessions.mockResolvedValue();
      mockAuthRepository.findSessionsByUserId.mockResolvedValue([]);

      // Act
      const result = await logoutUserUseCase.execute(validRequest);

      // Assert
      expect(result.sessionsInvalidated).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('User logout completed successfully', {
        userId: 'user-123',
        sessionsInvalidated: 0,
        reason: 'user_request'
      });
    });

    it('should handle case when user has only inactive sessions', async () => {
      // Arrange
      const inactiveSessions = mockSessions.map(session => ({ ...session, isActive: false }));
      mockAuthRepository.invalidateUserSessions.mockResolvedValue();
      mockAuthRepository.findSessionsByUserId.mockResolvedValue(inactiveSessions);

      // Act
      const result = await logoutUserUseCase.execute(validRequest);

      // Assert
      expect(result.sessionsInvalidated).toBe(0);
    });

    it('should handle different logout reasons', async () => {
      // Arrange
      const reasons: Array<'user_request' | 'timeout' | 'admin_force' | 'security_breach'> = [
        'user_request',
        'timeout',
        'admin_force',
        'security_breach'
      ];

      mockAuthRepository.invalidateUserSessions.mockResolvedValue();
      mockAuthRepository.findSessionsByUserId.mockResolvedValue(mockSessions);

      // Act & Assert
      for (const reason of reasons) {
        const request: LogoutUserRequest = { userId: 'user-123', reason };
        const result = await logoutUserUseCase.execute(request);
        expect(result.reason).toBe(reason);
      }
    });

    it('should log error when invalidateUserSessions fails', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockAuthRepository.invalidateUserSessions.mockRejectedValue(error);

      // Act & Assert
      await expect(logoutUserUseCase.execute(validRequest)).rejects.toThrow('Database connection failed');
      
      expect(mockLogger.error).toHaveBeenCalledWith('User logout failed', error, {
        userId: 'user-123',
        sessionId: undefined,
        reason: 'user_request'
      });
    });

    it('should log error when deleteSession fails', async () => {
      // Arrange
      const requestWithSession: LogoutUserRequest = {
        userId: 'user-123',
        sessionId: 'session-1',
        reason: 'user_request'
      };
      
      mockAuthRepository.invalidateUserSessions.mockResolvedValue();
      const error = new Error('Session not found');
      mockAuthRepository.deleteSession.mockRejectedValue(error);

      // Act & Assert
      await expect(logoutUserUseCase.execute(requestWithSession)).rejects.toThrow('Session not found');
      
      expect(mockLogger.error).toHaveBeenCalledWith('User logout failed', error, {
        userId: 'user-123',
        sessionId: 'session-1',
        reason: 'user_request'
      });
    });

    it('should log error when findSessionsByUserId fails', async () => {
      // Arrange
      mockAuthRepository.invalidateUserSessions.mockResolvedValue();
      const error = new Error('Database query failed');
      mockAuthRepository.findSessionsByUserId.mockRejectedValue(error);

      // Act & Assert
      await expect(logoutUserUseCase.execute(validRequest)).rejects.toThrow('Database query failed');
      
      expect(mockLogger.error).toHaveBeenCalledWith('User logout failed', error, {
        userId: 'user-123',
        sessionId: undefined,
        reason: 'user_request'
      });
    });

    it('should handle empty userId gracefully', async () => {
      // Arrange
      const requestWithEmptyUserId: LogoutUserRequest = {
        userId: '',
        reason: 'user_request'
      };
      
      mockAuthRepository.invalidateUserSessions.mockResolvedValue();
      mockAuthRepository.findSessionsByUserId.mockResolvedValue([]);

      // Act
      const result = await logoutUserUseCase.execute(requestWithEmptyUserId);

      // Assert
      expect(result.userId).toBe('');
      expect(result.sessionsInvalidated).toBe(0);
    });

    it('should validate timestamp format in response', async () => {
      // Arrange
      mockAuthRepository.invalidateUserSessions.mockResolvedValue();
      mockAuthRepository.findSessionsByUserId.mockResolvedValue(mockSessions);

      // Act
      const result = await logoutUserUseCase.execute(validRequest);

      // Assert
      expect(result.loggedOutAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(result.loggedOutAt)).toBeInstanceOf(Date);
    });
  });

  describe('edge cases', () => {
    it('should handle very long userId', async () => {
      // Arrange
      const longUserId = 'a'.repeat(1000);
      const request: LogoutUserRequest = {
        userId: longUserId,
        reason: 'user_request'
      };
      
      mockAuthRepository.invalidateUserSessions.mockResolvedValue();
      mockAuthRepository.findSessionsByUserId.mockResolvedValue([]);

      // Act
      const result = await logoutUserUseCase.execute(request);

      // Assert
      expect(result.userId).toBe(longUserId);
      expect(mockAuthRepository.invalidateUserSessions).toHaveBeenCalledWith(longUserId);
    });

    it('should handle special characters in userId', async () => {
      // Arrange
      const specialUserId = 'user-123!@#$%^&*()_+-=[]{}|;:,.<>?';
      const request: LogoutUserRequest = {
        userId: specialUserId,
        reason: 'user_request'
      };
      
      mockAuthRepository.invalidateUserSessions.mockResolvedValue();
      mockAuthRepository.findSessionsByUserId.mockResolvedValue([]);

      // Act
      const result = await logoutUserUseCase.execute(request);

      // Assert
      expect(result.userId).toBe(specialUserId);
    });
  });
});
