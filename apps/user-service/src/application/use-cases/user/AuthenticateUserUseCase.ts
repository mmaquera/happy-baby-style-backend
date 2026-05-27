import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IAuthRepository } from '../../../domain/repositories/IAuthRepository';
import { ILogger } from '@hbs/logging';
import { User } from '../../../domain/entities/User';
import { UserSession } from '../../../domain/entities/Auth';
import { LoggingDecorator } from '@hbs/logging';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from '../../../domain/errors/DomainError';
import bcrypt from 'bcryptjs';
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
    private logger: ILogger,
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
      hasIpAddress: !!data.ipAddress,
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
          role: user.role,
        },
        jwtSecret,
        { expiresIn: '1h' },
      );

      const refreshToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          type: 'refresh',
        },
        jwtSecret,
        { expiresIn: '7d' },
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
        isActive: true,
      });

      // Create session analytics automatically
      try {
        await this.authRepository.createSessionAnalytics({
          sessionId: session.sessionToken,
          userId: user.id,
          pageViews: 0,
          timeSpent: 0,
          bounceRate: 0,
          conversionRate: 0,
          deviceType: this.extractDeviceType(data.userAgent),
          browser: this.extractBrowser(data.userAgent),
          os: this.extractOS(data.userAgent),
          country: data.ipAddress ? await this.getCountryFromIP(data.ipAddress) : undefined,
          city: data.ipAddress ? await this.getCityFromIP(data.ipAddress) : undefined,
        });
      } catch (analyticsError) {
        // Log error but don't fail authentication
        this.logger.warn('Failed to create session analytics', {
          userId: user.id,
          sessionId: session.sessionToken,
          operation: 'AuthenticateUser',
          error: analyticsError instanceof Error ? analyticsError.message : 'Unknown error',
        });
      }

      // Update last login time
      await this.userRepository.updateUserLastLogin(user.id);

      this.logger.info('User authentication completed successfully', {
        userId: user.id,
        userRole: user.role,
        sessionId: session.id,
        sessionExpiresAt: sessionExpiresAt.toISOString(),
      });

      return {
        user,
        accessToken,
        refreshToken,
        session: {
          id: session.id,
          expiresAt: sessionExpiresAt.toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('User authentication failed', error as Error, {
        email: data.email,
        hasUserAgent: !!data.userAgent,
        hasIpAddress: !!data.ipAddress,
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

  private extractDeviceType(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;

    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  private extractBrowser(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;

    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'chrome';
    if (ua.includes('firefox')) return 'firefox';
    if (ua.includes('safari')) return 'safari';
    if (ua.includes('edge')) return 'edge';
    if (ua.includes('opera')) return 'opera';
    return 'unknown';
  }

  private extractOS(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;

    const ua = userAgent.toLowerCase();
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('mac os')) return 'macos';
    if (ua.includes('linux')) return 'linux';
    if (ua.includes('android')) return 'android';
    if (ua.includes('ios')) return 'ios';
    return 'unknown';
  }

  private async getCountryFromIP(ipAddress: string): Promise<string | undefined> {
    // TODO: Implement IP geolocation service
    // For now, return undefined
    return undefined;
  }

  private async getCityFromIP(ipAddress: string): Promise<string | undefined> {
    // TODO: Implement IP geolocation service
    // For now, return undefined
    return undefined;
  }
}
