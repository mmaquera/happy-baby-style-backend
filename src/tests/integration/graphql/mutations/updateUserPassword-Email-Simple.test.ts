import { UpdateUserPasswordUseCase } from '@application/use-cases/user/UpdateUserPasswordUseCase';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { IAuditRepository } from '@domain/repositories/IAuditRepository';
import { ISecurityEventRepository } from '@domain/repositories/ISecurityEventRepository';
import { IEmailService } from '@domain/interfaces/IEmailService';
import { ILogger } from '@domain/interfaces/ILogger';
import { ResponseFactory } from '@shared/factories/ResponseFactory';
import { RESPONSE_CODES } from '@shared/constants/ResponseCodes';

// Mock the LoggingDecorator to avoid issues in tests
jest.mock('@infrastructure/logging/LoggingDecorator', () => ({
  LoggingDecorator: {
    logUseCase: () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      return descriptor; // Return the original descriptor without modification
    }
  }
}));

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

// Mock del servicio de email
const mockEmailService: jest.Mocked<IEmailService> = {
  sendPasswordResetEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
  sendOrderConfirmationEmail: jest.fn(),
  verifyConfiguration: jest.fn()
};

// Mock del logger
const mockLogger: jest.Mocked<ILogger> = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn(),
  setTraceId: jest.fn()
};

describe('updateUserPassword GraphQL Mutation Integration - Email Implementation', () => {
  let updateUserPasswordUseCase: UpdateUserPasswordUseCase;

  const mockAuditRepository: jest.Mocked<IAuditRepository> = {
    create: jest.fn(),
    findByUserId: jest.fn(),
    findByAction: jest.fn(),
    findById: jest.fn(),
    findByTableAndRecord: jest.fn()
  };

  const mockSecurityEventRepository: jest.Mocked<ISecurityEventRepository> = {
    create: jest.fn(),
    findByUserId: jest.fn(),
    findByEventType: jest.fn(),
    findById: jest.fn(),
    findRecent: jest.fn()
  };

  beforeEach(() => {
    updateUserPasswordUseCase = new UpdateUserPasswordUseCase(
      mockAuthRepository, 
      mockAuditRepository,
      mockSecurityEventRepository,
      mockEmailService, 
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful password update with email', () => {
    it('should update password successfully with valid email', async () => {
      // Arrange
      const email = 'test@example.com';
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const currentPassword = 'CurrentPass123';
      const newPassword = 'NewPassword456';
      
      const context = {
        user: { id: userId },
        requestId: 'req_123',
        traceId: 'trace_456'
      };

      mockAuthRepository.getUserByEmail.mockResolvedValue({
        id: userId,
        email: email,
        isActive: true
      });
      mockAuthRepository.verifyPassword.mockResolvedValue(true);
      mockAuthRepository.updatePassword.mockResolvedValue();

      // Simulate the resolver function
      const resolver = async (_: any, { email, currentPassword, newPassword }: { 
        email: string; 
        currentPassword: string; 
        newPassword: string; 
      }, context: any) => {
        const startTime = Date.now();
        const traceId = context.traceId;
        
        try {
          await updateUserPasswordUseCase.execute({
            email,
            currentPassword,
            newPassword,
            confirmPassword: newPassword
          });

          const duration = Date.now() - startTime;
          
          return ResponseFactory.createSuccessResponse(
            {
              email,
              updatedAt: new Date().toISOString()
            },
            'Password updated successfully',
            RESPONSE_CODES.UPDATED,
            {
              requestId: context.requestId,
              traceId,
              duration
            }
          );
        } catch (error: any) {
          const duration = Date.now() - startTime;
          
          return ResponseFactory.createErrorResponse(
            error.message || 'Password update failed',
            error.code || RESPONSE_CODES.VALIDATION_ERROR,
            error.details,
            {
              requestId: context.requestId,
              traceId,
              duration
            }
          );
        }
      };

      // Act
      const result = await resolver(null, { email, currentPassword, newPassword }, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Password updated successfully');
      expect(result.code).toBe(RESPONSE_CODES.UPDATED);
      expect(result.data?.email).toBe(email);
      expect(result.metadata?.requestId).toBe('req_123');
      expect(result.metadata?.traceId).toBe('trace_456');
      
      // Verify repository calls
      expect(mockAuthRepository.getUserByEmail).toHaveBeenCalledWith(email);
      expect(mockAuthRepository.verifyPassword).toHaveBeenCalledWith(userId, currentPassword);
      expect(mockAuthRepository.updatePassword).toHaveBeenCalledWith(userId, newPassword);
    });

    it('should work with different email formats', async () => {
      // Test with different valid email formats
      const emailFormats = [
        'user@example.com',
        'test.user@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com'
      ];

      for (const email of emailFormats) {
        // Reset mocks
        jest.clearAllMocks();
        
        const userId = '550e8400-e29b-41d4-a716-446655440000';
        const currentPassword = 'CurrentPass123';
        const newPassword = 'NewPassword456';
        
        const context = {
          user: { id: userId },
          requestId: 'req_123',
          traceId: 'trace_456'
        };

        mockAuthRepository.getUserByEmail.mockResolvedValue({
          id: userId,
          email: email,
          isActive: true
        });
        mockAuthRepository.verifyPassword.mockResolvedValue(true);
        mockAuthRepository.updatePassword.mockResolvedValue();

        // Simulate the resolver function
        const resolver = async (_: any, { email, currentPassword, newPassword }: { 
          email: string; 
          currentPassword: string; 
          newPassword: string; 
        }, context: any) => {
          await updateUserPasswordUseCase.execute({
            email,
            currentPassword,
            newPassword,
            confirmPassword: newPassword
          });

          return ResponseFactory.createSuccessResponse(
            {
              email,
              updatedAt: new Date().toISOString()
            },
            'Password updated successfully',
            RESPONSE_CODES.UPDATED
          );
        };

        // Act
        const result = await resolver(null, { email, currentPassword, newPassword }, context);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.email).toBe(email);
        expect(mockAuthRepository.getUserByEmail).toHaveBeenCalledWith(email);
      }
    });
  });

  describe('Error cases with email', () => {
    it('should return error for invalid email format', async () => {
      // Arrange
      const invalidEmail = 'invalid-email-format';
      const currentPassword = 'CurrentPass123';
      const newPassword = 'NewPassword456';
      
      const context = {
        user: { id: 'user123' },
        requestId: 'req_123',
        traceId: 'trace_456'
      };

      // Simulate the resolver function
      const resolver = async (_: any, { email, currentPassword, newPassword }: { 
        email: string; 
        currentPassword: string; 
        newPassword: string; 
      }, context: any) => {
        try {
          await updateUserPasswordUseCase.execute({
            email,
            currentPassword,
            newPassword,
            confirmPassword: newPassword
          });

          return ResponseFactory.createSuccessResponse(
            {
              email,
              updatedAt: new Date().toISOString()
            },
            'Password updated successfully',
            RESPONSE_CODES.UPDATED
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            error.message || 'Password update failed',
            error.code || RESPONSE_CODES.VALIDATION_ERROR,
            error.details
          );
        }
      };

      // Act
      const result = await resolver(null, { email: invalidEmail, currentPassword, newPassword }, context);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid email format');
    });

    it('should return error for non-existent email', async () => {
      // Arrange
      const nonExistentEmail = 'nonexistent@example.com';
      const currentPassword = 'CurrentPass123';
      const newPassword = 'NewPassword456';
      
      const context = {
        user: { id: 'user123' },
        requestId: 'req_123',
        traceId: 'trace_456'
      };

      mockAuthRepository.getUserByEmail.mockResolvedValue(null);

      // Simulate the resolver function
      const resolver = async (_: any, { email, currentPassword, newPassword }: { 
        email: string; 
        currentPassword: string; 
        newPassword: string; 
      }, context: any) => {
        try {
          await updateUserPasswordUseCase.execute({
            email,
            currentPassword,
            newPassword,
            confirmPassword: newPassword
          });

          return ResponseFactory.createSuccessResponse(
            {
              email,
              updatedAt: new Date().toISOString()
            },
            'Password updated successfully',
            RESPONSE_CODES.UPDATED
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            error.message || 'Password update failed',
            error.code || RESPONSE_CODES.VALIDATION_ERROR,
            error.details
          );
        }
      };

      // Act
      const result = await resolver(null, { email: nonExistentEmail, currentPassword, newPassword }, context);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return error for incorrect current password', async () => {
      // Arrange
      const email = 'test@example.com';
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const currentPassword = 'WrongPassword123';
      const newPassword = 'NewPassword456';
      
      const context = {
        user: { id: userId },
        requestId: 'req_123',
        traceId: 'trace_456'
      };

      mockAuthRepository.getUserByEmail.mockResolvedValue({
        id: userId,
        email: email,
        isActive: true
      });
      mockAuthRepository.verifyPassword.mockResolvedValue(false); // Incorrect password

      // Simulate the resolver function
      const resolver = async (_: any, { email, currentPassword, newPassword }: { 
        email: string; 
        currentPassword: string; 
        newPassword: string; 
      }, context: any) => {
        try {
          await updateUserPasswordUseCase.execute({
            email,
            currentPassword,
            newPassword,
            confirmPassword: newPassword
          });

          return ResponseFactory.createSuccessResponse(
            {
              email,
              updatedAt: new Date().toISOString()
            },
            'Password updated successfully',
            RESPONSE_CODES.UPDATED
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            error.message || 'Password update failed',
            error.code || RESPONSE_CODES.VALIDATION_ERROR,
            error.details
          );
        }
      };

      // Act
      const result = await resolver(null, { email, currentPassword, newPassword }, context);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('incorrect');
    });
  });

  describe('Database query verification with email', () => {
    it('should call getUserByEmail with correct email format', async () => {
      // Arrange
      const email = 'test@example.com';
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const currentPassword = 'CurrentPass123';
      const newPassword = 'NewPassword456';

      mockAuthRepository.getUserByEmail.mockResolvedValue({
        id: userId,
        email: email,
        isActive: true
      });
      mockAuthRepository.verifyPassword.mockResolvedValue(true);
      mockAuthRepository.updatePassword.mockResolvedValue();

      // Act
      await updateUserPasswordUseCase.execute({
        email,
        currentPassword,
        newPassword,
        confirmPassword: newPassword
      });

      // Assert
      expect(mockAuthRepository.getUserByEmail).toHaveBeenCalledWith(email);
      expect(mockAuthRepository.getUserByEmail).toHaveBeenCalledTimes(1);
      
      // Verify the email format is preserved
      const calledWith = mockAuthRepository.getUserByEmail.mock.calls[0][0];
      expect(calledWith).toBe(email);
      expect(calledWith).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // Basic email regex
    });

    it('should maintain email-to-userId mapping consistency', async () => {
      // Arrange
      const email = 'test@example.com';
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const currentPassword = 'CurrentPass123';
      const newPassword = 'NewPassword456';

      mockAuthRepository.getUserByEmail.mockResolvedValue({
        id: userId,
        email: email,
        isActive: true
      });
      mockAuthRepository.verifyPassword.mockResolvedValue(true);
      mockAuthRepository.updatePassword.mockResolvedValue();

      // Act
      await updateUserPasswordUseCase.execute({
        email,
        currentPassword,
        newPassword,
        confirmPassword: newPassword
      });

      // Assert - Verify that email is used to find user, then userId is used for operations
      expect(mockAuthRepository.getUserByEmail).toHaveBeenCalledWith(email);
      expect(mockAuthRepository.verifyPassword).toHaveBeenCalledWith(userId, currentPassword);
      expect(mockAuthRepository.updatePassword).toHaveBeenCalledWith(userId, newPassword);
      
      // Verify the mapping is consistent
      const getUserByEmailCall = mockAuthRepository.getUserByEmail.mock.calls[0];
      const verifyPasswordCall = mockAuthRepository.verifyPassword.mock.calls[0];
      const updatePasswordCall = mockAuthRepository.updatePassword.mock.calls[0];
      
      expect(getUserByEmailCall[0]).toBe(email);
      expect(verifyPasswordCall[0]).toBe(userId);
      expect(updatePasswordCall[0]).toBe(userId);
    });
  });
});
