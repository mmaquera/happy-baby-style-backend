import { CreateUserSessionAnalyticsUseCase } from '@application/use-cases/user/CreateUserSessionAnalyticsUseCase';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@hbs/logging';
import { UserSessionAnalytics, CreateUserSessionAnalyticsRequest } from '@domain/entities/Auth';
import { ValidationError } from '@domain/errors/DomainError';

// Mock repositories and services
const mockAuthRepository: jest.Mocked<IAuthRepository> = {
  createSessionAnalytics: jest.fn(),
  findSessionAnalyticsBySessionId: jest.fn(),
  findSessionAnalyticsById: jest.fn(),
  findSessionAnalyticsByUserId: jest.fn(),
  updateSessionAnalytics: jest.fn(),
  deleteSessionAnalytics: jest.fn(),
  deleteSessionAnalyticsBySessionId: jest.fn(),
  deleteSessionAnalyticsByUserId: jest.fn(),
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

describe('CreateUserSessionAnalyticsUseCase', () => {
  let useCase: CreateUserSessionAnalyticsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateUserSessionAnalyticsUseCase(mockAuthRepository, mockLogger);
  });

  describe('execute', () => {
    const validRequest: CreateUserSessionAnalyticsRequest = {
      sessionId: 'session-123',
      userId: 'user-456',
      pageViews: 5,
      timeSpent: 300,
      bounceRate: 0.2,
      conversionRate: 0.1,
      deviceType: 'mobile',
      browser: 'chrome',
      os: 'android',
      country: 'PE',
      city: 'Lima'
    };

    const mockAnalytics: UserSessionAnalytics = {
      id: 'analytics-789',
      sessionId: 'session-123',
      userId: 'user-456',
      pageViews: 5,
      timeSpent: 300,
      bounceRate: 0.2,
      conversionRate: 0.1,
      deviceType: 'mobile',
      browser: 'chrome',
      os: 'android',
      country: 'PE',
      city: 'Lima',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:00:00Z')
    };

    it('should create session analytics successfully', async () => {
      // Arrange
      mockAuthRepository.findSessionAnalyticsBySessionId.mockResolvedValue(null);
      mockAuthRepository.createSessionAnalytics.mockResolvedValue(mockAnalytics);

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expect(result.analytics).toEqual(mockAnalytics);
      expect(mockAuthRepository.createSessionAnalytics).toHaveBeenCalledWith({
        sessionId: 'session-123',
        userId: 'user-456',
        pageViews: 5,
        timeSpent: 300,
        bounceRate: 0.2,
        conversionRate: 0.1,
        deviceType: 'mobile',
        browser: 'chrome',
        os: 'android',
        country: 'PE',
        city: 'Lima'
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User session analytics created successfully',
        expect.objectContaining({
          analyticsId: 'analytics-789',
          sessionId: 'session-123',
          userId: 'user-456'
        })
      );
    });

    it('should return existing analytics if session already has analytics', async () => {
      // Arrange
      mockAuthRepository.findSessionAnalyticsBySessionId.mockResolvedValue(mockAnalytics);

      // Act
      const result = await useCase.execute(validRequest);

      // Assert
      expect(result.analytics).toEqual(mockAnalytics);
      expect(mockAuthRepository.createSessionAnalytics).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Session analytics already exist for session',
        expect.objectContaining({
          sessionId: 'session-123',
          analyticsId: 'analytics-789'
        })
      );
    });

    it('should use default values when optional fields are not provided', async () => {
      // Arrange
      const minimalRequest: CreateUserSessionAnalyticsRequest = {
        sessionId: 'session-123',
        userId: 'user-456'
      };
      mockAuthRepository.findSessionAnalyticsBySessionId.mockResolvedValue(null);
      mockAuthRepository.createSessionAnalytics.mockResolvedValue(mockAnalytics);

      // Act
      await useCase.execute(minimalRequest);

      // Assert
      expect(mockAuthRepository.createSessionAnalytics).toHaveBeenCalledWith({
        sessionId: 'session-123',
        userId: 'user-456',
        pageViews: 0,
        timeSpent: 0,
        bounceRate: 0,
        conversionRate: 0,
        deviceType: undefined,
        browser: undefined,
        os: undefined,
        country: undefined,
        city: undefined
      });
    });

    it('should throw ValidationError when sessionId is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, sessionId: '' };

      // Act & Assert
      await expect(useCase.execute(invalidRequest)).rejects.toThrow(ValidationError);
      expect(mockAuthRepository.createSessionAnalytics).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when userId is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, userId: '' };

      // Act & Assert
      await expect(useCase.execute(invalidRequest)).rejects.toThrow(ValidationError);
      expect(mockAuthRepository.createSessionAnalytics).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when pageViews is negative', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, pageViews: -1 };

      // Act & Assert
      await expect(useCase.execute(invalidRequest)).rejects.toThrow(ValidationError);
      expect(mockAuthRepository.createSessionAnalytics).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when timeSpent is negative', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, timeSpent: -100 };

      // Act & Assert
      await expect(useCase.execute(invalidRequest)).rejects.toThrow(ValidationError);
      expect(mockAuthRepository.createSessionAnalytics).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when bounceRate is out of range', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, bounceRate: 1.5 };

      // Act & Assert
      await expect(useCase.execute(invalidRequest)).rejects.toThrow(ValidationError);
      expect(mockAuthRepository.createSessionAnalytics).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when conversionRate is out of range', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, conversionRate: -0.1 };

      // Act & Assert
      await expect(useCase.execute(invalidRequest)).rejects.toThrow(ValidationError);
      expect(mockAuthRepository.createSessionAnalytics).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const repositoryError = new Error('Database connection failed');
      mockAuthRepository.findSessionAnalyticsBySessionId.mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(useCase.execute(validRequest)).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create user session analytics',
        repositoryError,
        expect.objectContaining({
          sessionId: 'session-123',
          userId: 'user-456'
        })
      );
    });
  });
});
