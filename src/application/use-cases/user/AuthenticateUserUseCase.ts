import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IAuthRepository } from '../../../domain/repositories/IAuthRepository';
import { ILogger } from '../../../domain/interfaces/ILogger';
import { User } from '../../../domain/entities/User';
import { UserSession } from '../../../domain/entities/Auth';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';
import { ValidationError, NotFoundError, UnauthorizedError } from '../../../domain/errors/DomainError';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface AuthenticateUserRequest {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthenticateUserResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  session: {
    id: string;
    expiresAt: string;
  };
}

export class AuthenticateUserUseCase {
  constructor(
    private userRepository: IUserRepository,
    private authRepository: IAuthRepository,
    private logger: ILogger
  ) {}

  // @LoggingDecorator.logUseCase({
  //   includeArgs: true,
  //   includeResult: true,
  //   includeDuration: true,
  //   context: { useCase: 'AuthenticateUser' }
  // })
  async execute(data: AuthenticateUserRequest): Promise<AuthenticateUserResponse> {
    this.logger.info('Starting user authentication process', {
      email: data.email,
      hasUserAgent: !!data.userAgent,
      hasIpAddress: !!data.ipAddress
    });

    try {
      // Validate email format
      this.validateEmail(data.email);
      
      // Validate password
      this.validatePassword(data.password);

      // Check if user exists
      const user = await this.userRepository.getUserByEmail(data.email);
      if (!user) {
        throw new NotFoundError('User', 'not found');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new UnauthorizedError('User account is deactivated');
      }

      // Verify password hash
      const storedPassword = await this.userRepository.getUserPasswordHash(user.id);
      if (!storedPassword) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const isPasswordValid = await bcrypt.compare(data.password, storedPassword);
      if (!isPasswordValid) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // Generate JWT tokens
      const jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
      const accessToken = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        jwtSecret,
        { expiresIn: '1h' }
      );

      const refreshToken = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          type: 'refresh'
        },
        jwtSecret,
        { expiresIn: '7d' }
      );

      // Create user session
      const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const session = await this.authRepository.createSession({
        userId: user.id,
        sessionToken: crypto.randomUUID(),
        accessToken,
        refreshToken,
        expiresAt: sessionExpiresAt,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        isActive: true
      });

      // Update last login time
      await this.userRepository.updateUserLastLogin(user.id);

      this.logger.info('User authentication completed successfully', {
        userId: user.id,
        userRole: user.role,
        sessionId: session.id,
        sessionExpiresAt: sessionExpiresAt.toISOString()
      });

      return {
        user,
        accessToken,
        refreshToken,
        session: {
          id: session.id,
          expiresAt: sessionExpiresAt.toISOString()
        }
      };

    } catch (error) {
      this.logger.error('User authentication failed', error as Error, {
        email: data.email,
        hasUserAgent: !!data.userAgent,
        hasIpAddress: !!data.ipAddress
      });
      throw error;
    }
  }

  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }
  }

  private validatePassword(password: string): void {
    if (!password || password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long');
    }
  }
}