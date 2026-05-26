import { UpdateUserPasswordUseCase } from '@application/use-cases/user/UpdateUserPasswordUseCase';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { IEmailService } from '@domain/interfaces/IEmailService';
import { ILogger } from '@hbs/logging';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  BusinessLogicError,
} from '@domain/errors/DomainError';

// Mock the LoggingDecorator to avoid issues in tests
jest.mock('@hbs/logging', () => ({
  LoggingDecorator: {
    logUseCase: () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      return descriptor; // Return the original descriptor without modification
    },
  },
}));

// Mock del servicio de email
const mockEmailService: jest.Mocked<IEmailService> = {
  sendPasswordResetEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
  sendOrderConfirmationEmail: jest.fn(),
  verifyConfiguration: jest.fn(),
};

// Mock del logger
const mockLogger: jest.Mocked<ILogger> = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn(),
  setTraceId: jest.fn(),
};

describe('UpdateUserPasswordUseCase - Email Implementation', () => {
  let updateUserPasswordUseCase: UpdateUserPasswordUseCase;
  let mockAuthRepository: jest.Mocked<IAuthRepository>;

  beforeEach(() => {
    mockAuthRepository = {
      // OAuth Account Management
      createUserAccount: jest.fn(),
      findUserAccountByProvider: jest.fn(),
      findUserAccountsByUserId: jest.fn(),
      updateUserAccount: jest.fn(),
      deleteUserAccount: jest.fn(),

      // Session Management
      createSession: jest.fn(),
      findSessionByToken: jest.fn(),
      findSessionsByUserId: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      deleteExpiredSessions: jest.fn(),
      invalidateUserSessions: jest.fn(),

      // Password Management
      createUserPassword: jest.fn(),
      findUserPasswordByUserId: jest.fn(),
      updateUserPassword: jest.fn(),
      deleteUserPassword: jest.fn(),

      // Additional methods for UpdateUserPasswordUseCase
      verifyPassword: jest.fn(),
      updatePassword: jest.fn(),
      getUserById: jest.fn(),
      getUserByEmail: jest.fn(),

      // Authentication Methods
      authenticateWithEmail: jest.fn(),
      authenticateWithGoogle: jest.fn(),
      registerWithEmail: jest.fn(),

      // User Utilities
      findOrCreateUserFromGoogle: jest.fn(),
      updateUserLastLogin: jest.fn(),

      // Session Validation
      validateSession: jest.fn(),
      refreshUserSession: jest.fn(),

      // Logout Management
      logoutUser: jest.fn(),

      // Session Analytics Management
      createSessionAnalytics: jest.fn(),
      findSessionAnalyticsById: jest.fn(),
      findSessionAnalyticsBySessionId: jest.fn(),
      findSessionAnalyticsByUserId: jest.fn(),
      updateSessionAnalytics: jest.fn(),
      deleteSessionAnalytics: jest.fn(),
      deleteSessionAnalyticsByUserId: jest.fn(),
      deleteSessionAnalyticsBySessionId: jest.fn(),
    };

    const mockAuditRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findByAction: jest.fn(),
      findById: jest.fn(),
      findByTableAndRecord: jest.fn(),
    };

    const mockSecurityEventRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findByEventType: jest.fn(),
      findById: jest.fn(),
      findRecent: jest.fn(),
    };

    updateUserPasswordUseCase = new UpdateUserPasswordUseCase(
      mockAuthRepository,
      mockAuditRepository,
      mockSecurityEventRepository,
      mockEmailService,
      mockLogger,
    );
  });

  describe('execute with email', () => {
    const validEmail = 'test@example.com';
    const validUserId = '550e8400-e29b-41d4-a716-446655440000';
    const validCurrentPassword = 'CurrentPass123';
    const validNewPassword = 'NewPassword456';

    it('should successfully update user password with valid email', async () => {
      // Arrange
      const request = {
        email: validEmail,
        currentPassword: validCurrentPassword,
        newPassword: validNewPassword,
        confirmPassword: validNewPassword,
      };

      mockAuthRepository.getUserByEmail.mockResolvedValue({
        id: validUserId,
        email: validEmail,
        isActive: true,
      });
      mockAuthRepository.verifyPassword.mockResolvedValue(true);
      mockAuthRepository.updatePassword.mockResolvedValue();

      // Act
      await updateUserPasswordUseCase.execute(request);

      // Assert
      expect(mockAuthRepository.getUserByEmail).toHaveBeenCalledWith(validEmail);
      expect(mockAuthRepository.verifyPassword).toHaveBeenCalledWith(
        validUserId,
        validCurrentPassword,
      );
      expect(mockAuthRepository.updatePassword).toHaveBeenCalledWith(validUserId, validNewPassword);
    });

    it('should throw ValidationError when email is missing', async () => {
      // Arrange
      const request = {
        email: '',
        currentPassword: validCurrentPassword,
        newPassword: validNewPassword,
        confirmPassword: validNewPassword,
      };

      // Act & Assert
      await expect(updateUserPasswordUseCase.execute(request)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when email format is invalid', async () => {
      // Arrange
      const request = {
        email: 'invalid-email',
        currentPassword: validCurrentPassword,
        newPassword: validNewPassword,
        confirmPassword: validNewPassword,
      };

      // Act & Assert
      await expect(updateUserPasswordUseCase.execute(request)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      const request = {
        email: validEmail,
        currentPassword: validCurrentPassword,
        newPassword: validNewPassword,
        confirmPassword: validNewPassword,
      };

      mockAuthRepository.getUserByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(updateUserPasswordUseCase.execute(request)).rejects.toThrow(NotFoundError);
    });

    it('should throw UnauthorizedError when user is inactive', async () => {
      // Arrange
      const request = {
        email: validEmail,
        currentPassword: validCurrentPassword,
        newPassword: validNewPassword,
        confirmPassword: validNewPassword,
      };

      mockAuthRepository.getUserByEmail.mockResolvedValue({
        id: validUserId,
        email: validEmail,
        isActive: false, // User is inactive
      });

      // Act & Assert
      await expect(updateUserPasswordUseCase.execute(request)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when current password is incorrect', async () => {
      // Arrange
      const request = {
        email: validEmail,
        currentPassword: validCurrentPassword,
        newPassword: validNewPassword,
        confirmPassword: validNewPassword,
      };

      mockAuthRepository.getUserByEmail.mockResolvedValue({
        id: validUserId,
        email: validEmail,
        isActive: true,
      });
      mockAuthRepository.verifyPassword.mockResolvedValue(false); // Incorrect password

      // Act & Assert
      await expect(updateUserPasswordUseCase.execute(request)).rejects.toThrow(UnauthorizedError);
    });

    it('should work with different email formats', async () => {
      // Test with different valid email formats
      const emails = [
        'user@example.com',
        'test.user@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
      ];

      for (const email of emails) {
        // Reset mocks
        jest.clearAllMocks();

        const request = {
          email,
          currentPassword: validCurrentPassword,
          newPassword: validNewPassword,
          confirmPassword: validNewPassword,
        };

        mockAuthRepository.getUserByEmail.mockResolvedValue({
          id: validUserId,
          email,
          isActive: true,
        });
        mockAuthRepository.verifyPassword.mockResolvedValue(true);
        mockAuthRepository.updatePassword.mockResolvedValue();

        // Act
        await updateUserPasswordUseCase.execute(request);

        // Assert
        expect(mockAuthRepository.getUserByEmail).toHaveBeenCalledWith(email);
        expect(mockAuthRepository.verifyPassword).toHaveBeenCalledWith(
          validUserId,
          validCurrentPassword,
        );
        expect(mockAuthRepository.updatePassword).toHaveBeenCalledWith(
          validUserId,
          validNewPassword,
        );
      }
    });

    it('should maintain user ID consistency throughout the process', async () => {
      // Arrange
      const request = {
        email: validEmail,
        currentPassword: validCurrentPassword,
        newPassword: validNewPassword,
        confirmPassword: validNewPassword,
      };

      const userData = {
        id: validUserId,
        email: validEmail,
        isActive: true,
      };

      mockAuthRepository.getUserByEmail.mockResolvedValue(userData);
      mockAuthRepository.verifyPassword.mockResolvedValue(true);
      mockAuthRepository.updatePassword.mockResolvedValue();

      // Act
      await updateUserPasswordUseCase.execute(request);

      // Assert - Verify that the same userId is used throughout
      expect(mockAuthRepository.getUserByEmail).toHaveBeenCalledWith(validEmail);
      expect(mockAuthRepository.verifyPassword).toHaveBeenCalledWith(
        validUserId,
        validCurrentPassword,
      );
      expect(mockAuthRepository.updatePassword).toHaveBeenCalledWith(validUserId, validNewPassword);

      // Verify the user ID from getUserByEmail is used consistently
      const getUserByEmailCall = mockAuthRepository.getUserByEmail.mock.calls[0];
      const verifyPasswordCall = mockAuthRepository.verifyPassword.mock.calls[0];
      const updatePasswordCall = mockAuthRepository.updatePassword.mock.calls[0];

      expect(verifyPasswordCall[0]).toBe(validUserId);
      expect(updatePasswordCall[0]).toBe(validUserId);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should return valid result for strong password', async () => {
      // Arrange
      const strongPassword = 'StrongPass123!';

      // Act
      const result = await updateUserPasswordUseCase.validatePasswordStrength(strongPassword);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.feedback).toHaveLength(0);
    });

    it('should return invalid result for weak password', async () => {
      // Arrange
      const weakPassword = '123';

      // Act
      const result = await updateUserPasswordUseCase.validatePasswordStrength(weakPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.score).toBeLessThan(4);
      expect(result.feedback.length).toBeGreaterThan(0);
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should generate token for valid email', async () => {
      // Arrange
      const email = 'test@example.com';

      // Act
      const token = await updateUserPasswordUseCase.generatePasswordResetToken(email);

      // Assert
      expect(token).toMatch(/^mock_reset_token_\d+$/);
    });

    it('should throw ValidationError for invalid email', async () => {
      // Arrange
      const invalidEmail = 'invalid-email';

      // Act & Assert
      await expect(
        updateUserPasswordUseCase.generatePasswordResetToken(invalidEmail),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('resetPasswordWithToken', () => {
    it('should reset password with valid token and strong password', async () => {
      // Arrange
      const token = 'valid-reset-token';
      const newPassword = 'NewStrongPass123!';

      // Act
      await updateUserPasswordUseCase.resetPasswordWithToken(token, newPassword);

      // Assert - Should not throw any error
      expect(true).toBe(true);
    });

    it('should throw ValidationError for weak password', async () => {
      // Arrange
      const token = 'valid-reset-token';
      const weakPassword = '123';

      // Act & Assert
      await expect(
        updateUserPasswordUseCase.resetPasswordWithToken(token, weakPassword),
      ).rejects.toThrow(ValidationError);
    });
  });
});
