import { AuthenticateUserUseCase, AuthenticateUserRequest, AuthenticateUserResponse } from '@application/use-cases/user/AuthenticateUserUseCase';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@hbs/logging';
import { User, UserRole } from '@domain/entities/User';
import { UserSession } from '@domain/entities/Auth';
import { ValidationError, NotFoundError, UnauthorizedError } from '@domain/errors/DomainError';
import bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthenticateUserUseCase', () => {
  let authenticateUserUseCase: AuthenticateUserUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockAuthRepository: jest.Mocked<IAuthRepository>;
  let mockLogger: jest.Mocked<ILogger>;

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
      favoriteProductIds: []
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockSession: UserSession = {
    id: 'session-123',
    userId: 'user-123',
    sessionToken: 'session-token-123',
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    userAgent: 'Mozilla/5.0...',
    ipAddress: '192.168.1.1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    mockUserRepository = {
      getUserByEmail: jest.fn(),
      getUserPasswordHash: jest.fn(),
      updateUserLastLogin: jest.fn(),
      createUser: jest.fn(),
      getUserById: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      getUsers: jest.fn(),
      getUserStats: jest.fn(),
      getUsersByRole: jest.fn(),
      getActiveUsers: jest.fn(),
      searchUsers: jest.fn(),
      createUserProfile: jest.fn(),
      updateUserProfile: jest.fn(),
      deleteUserProfile: jest.fn(),
      getUserProfile: jest.fn(),
      getUserAddresses: jest.fn(),
      createUserAddress: jest.fn(),
      updateUserAddress: jest.fn(),
      deleteUserAddress: jest.fn(),
      getDefaultAddress: jest.fn()
    } as any;

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
      refreshUserSession: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    authenticateUserUseCase = new AuthenticateUserUseCase(
      mockUserRepository,
      mockAuthRepository,
      mockLogger
    );

    // Mock bcrypt.compare to return true by default
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validRequest: AuthenticateUserRequest = {
      email: 'test@example.com',
      password: 'password123',
      userAgent: 'Mozilla/5.0...',
      ipAddress: '192.168.1.1'
    };

    it('should successfully authenticate user and create session', async () => {
      // Arrange
      mockUserRepository.getUserByEmail.mockResolvedValue(mockUser);
      mockUserRepository.getUserPasswordHash.mockResolvedValue('hashed-password');
      mockUserRepository.updateUserLastLogin.mockResolvedValue();
      mockAuthRepository.createSession.mockResolvedValue(mockSession);

      // Act
      const result = await authenticateUserUseCase.execute(validRequest);

      // Assert
      expect(result.user).toEqual(mockUser);
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.session.id).toEqual(mockSession.id);
      expect(result.session.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      expect(mockUserRepository.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserRepository.getUserPasswordHash).toHaveBeenCalledWith('user-123');
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(mockUserRepository.updateUserLastLogin).toHaveBeenCalledWith('user-123');
      expect(mockAuthRepository.createSession).toHaveBeenCalledWith({
        userId: 'user-123',
        sessionToken: expect.any(String),
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresAt: expect.any(Date),
        userAgent: 'Mozilla/5.0...',
        ipAddress: '192.168.1.1',
        isActive: true
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting user authentication process',
        expect.objectContaining({
          email: 'test@example.com',
          hasUserAgent: true,
          hasIpAddress: true
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'User authentication completed successfully',
        expect.objectContaining({
          userId: 'user-123',
          userRole: 'customer',
          sessionId: 'session-123'
        })
      );
    });

    it('should throw ValidationError for invalid email format', async () => {
      // Arrange
      const invalidRequest: AuthenticateUserRequest = {
        ...validRequest,
        email: 'invalid-email'
      };

      // Act & Assert
      await expect(authenticateUserUseCase.execute(invalidRequest))
        .rejects
        .toThrow(ValidationError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'User authentication failed',
        expect.any(ValidationError),
        expect.objectContaining({
          email: 'invalid-email'
        })
      );
    });

    it('should throw ValidationError for password too short', async () => {
      // Arrange
      const invalidRequest: AuthenticateUserRequest = {
        ...validRequest,
        password: '123'
      };

      // Act & Assert
      await expect(authenticateUserUseCase.execute(invalidRequest))
        .rejects
        .toThrow(ValidationError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'User authentication failed',
        expect.any(ValidationError),
        expect.objectContaining({
          email: 'test@example.com'
        })
      );
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      mockUserRepository.getUserByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(authenticateUserUseCase.execute(validRequest))
        .rejects
        .toThrow(NotFoundError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'User authentication failed',
        expect.any(NotFoundError),
        expect.objectContaining({
          email: 'test@example.com'
        })
      );
    });

    it('should throw UnauthorizedError when user account is deactivated', async () => {
      // Arrange
      const deactivatedUser = { ...mockUser, isActive: false };
      mockUserRepository.getUserByEmail.mockResolvedValue(deactivatedUser);

      // Act & Assert
      await expect(authenticateUserUseCase.execute(validRequest))
        .rejects
        .toThrow(UnauthorizedError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'User authentication failed',
        expect.any(UnauthorizedError),
        expect.objectContaining({
          email: 'test@example.com'
        })
      );
    });

    it('should throw UnauthorizedError when password is invalid', async () => {
      // Arrange
      mockUserRepository.getUserByEmail.mockResolvedValue(mockUser);
      mockUserRepository.getUserPasswordHash.mockResolvedValue('hashed-password');
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(authenticateUserUseCase.execute(validRequest))
        .rejects
        .toThrow(UnauthorizedError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'User authentication failed',
        expect.any(UnauthorizedError),
        expect.objectContaining({
          email: 'test@example.com'
        })
      );
    });

    it('should throw UnauthorizedError when user has no password', async () => {
      // Arrange
      mockUserRepository.getUserByEmail.mockResolvedValue(mockUser);
      mockUserRepository.getUserPasswordHash.mockResolvedValue(null);

      // Act & Assert
      await expect(authenticateUserUseCase.execute(validRequest))
        .rejects
        .toThrow(UnauthorizedError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'User authentication failed',
        expect.any(UnauthorizedError),
        expect.objectContaining({
          email: 'test@example.com'
        })
      );
    });

    it('should work without userAgent and ipAddress', async () => {
      // Arrange
      const requestWithoutContext: AuthenticateUserRequest = {
        email: 'test@example.com',
        password: 'password123'
      };

      mockUserRepository.getUserByEmail.mockResolvedValue(mockUser);
      mockUserRepository.getUserPasswordHash.mockResolvedValue('hashed-password');
      mockUserRepository.updateUserLastLogin.mockResolvedValue();
      mockAuthRepository.createSession.mockResolvedValue(mockSession);

      // Act
      const result = await authenticateUserUseCase.execute(requestWithoutContext);

      // Assert
      expect(result.session).toBeDefined();
      expect(mockAuthRepository.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: undefined,
          ipAddress: undefined
        })
      );
    });

    it('should handle session creation failure', async () => {
      // Arrange
      mockUserRepository.getUserByEmail.mockResolvedValue(mockUser);
      mockUserRepository.getUserPasswordHash.mockResolvedValue('hashed-password');
      mockUserRepository.updateUserLastLogin.mockResolvedValue();
      mockAuthRepository.createSession.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(authenticateUserUseCase.execute(validRequest))
        .rejects
        .toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'User authentication failed',
        expect.any(Error),
        expect.objectContaining({
          email: 'test@example.com'
        })
      );
    });

    it('should generate unique session token and expiration', async () => {
      // Arrange
      mockUserRepository.getUserByEmail.mockResolvedValue(mockUser);
      mockUserRepository.getUserPasswordHash.mockResolvedValue('hashed-password');
      mockUserRepository.updateUserLastLogin.mockResolvedValue();
      mockAuthRepository.createSession.mockResolvedValue(mockSession);

      // Act
      await authenticateUserUseCase.execute(validRequest);

      // Assert
      expect(mockAuthRepository.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionToken: expect.any(String),
          expiresAt: expect.any(Date)
        })
      );

      const callArgs = mockAuthRepository.createSession.mock.calls[0][0];
      expect(callArgs.sessionToken).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      
      const now = new Date();
      const expiresAt = callArgs.expiresAt;
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(now.getTime() + 24 * 60 * 60 * 1000 + 1000); // 24 hours + 1 second tolerance
    });
  });
});
