import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IAuthRepository } from '../../../domain/repositories/IAuthRepository';
import { ISecurityEventRepository } from '../../../domain/repositories/ISecurityEventRepository';
import { IMfaChallengeStore } from '../../../domain/ports/IMfaChallengeStore';
import { ILogger } from '@hbs/logging';
import { User } from '../../../domain/entities/User';
import { UserSession } from '../../../domain/entities/Auth';
import { SecurityEventType } from '../../../domain/entities/Audit';
import { IGeoIpPort } from '../../../domain/ports/IGeoIpPort';
import {
  ValidationError,
  UnauthorizedError,
} from '../../../domain/errors/DomainError';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { resolvePermissions, TOKEN_TYPES } from '@hbs/auth';
import type { IEffectivePermissionsResolver } from '../../../domain/interfaces/IEffectivePermissionsResolver';

const MAX_LOGIN_ATTEMPTS_DEFAULT = 5;
const LOCKOUT_DURATION_SECONDS_DEFAULT = 900; // 15 minutes
const MFA_CHALLENGE_TTL_SECONDS = 300; // 5 minutes

export interface AuthenticateUserRequest {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthenticateUserResponse {
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  session?: {
    id: string;
    expiresAt: string;
  };
  // MFA step-up fields
  mfaRequired?: boolean;
  mfaChallengeToken?: string;
}

export class AuthenticateUserUseCase {
  constructor(
    private userRepository: IUserRepository,
    private authRepository: IAuthRepository,
    private logger: ILogger,
    private effectivePermissionsResolver: IEffectivePermissionsResolver,
    private securityEventRepository: ISecurityEventRepository,
    private geoIpPort: IGeoIpPort,
    private mfaChallengeStore?: IMfaChallengeStore,
  ) {}

  async execute(data: AuthenticateUserRequest): Promise<AuthenticateUserResponse> {
    this.logger.info('Starting user authentication process', {
      email: data.email,
      hasUserAgent: !!data.userAgent,
      hasIpAddress: !!data.ipAddress,
    });

    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS ?? String(MAX_LOGIN_ATTEMPTS_DEFAULT), 10);
    const lockoutSeconds = parseInt(process.env.LOCKOUT_DURATION ?? String(LOCKOUT_DURATION_SECONDS_DEFAULT), 10);

    try {
      // 1. Validate input format
      this.validateEmail(data.email);
      this.validatePassword(data.password);

      // 2. Lookup user — failure must NOT reveal whether the account exists
      const user = await this.userRepository.getUserByEmail(data.email);
      if (!user) {
        await this.emitSecurityEvent(SecurityEventType.LOGIN_FAILED, undefined, data, {
          reason: 'user_not_found',
        });
        throw new UnauthorizedError('Invalid email or password');
      }

      // 3. Account locked — same generic message, no information leak
      const now = new Date();
      if (user.lockedUntil != null && user.lockedUntil > now) {
        await this.emitSecurityEvent(SecurityEventType.LOGIN_FAILED, user.id, data, {
          reason: 'account_locked',
          lockedUntil: user.lockedUntil.toISOString(),
        });
        throw new UnauthorizedError('Invalid email or password');
      }

      // 4. Inactive account — same generic message
      if (!user.isActive) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // 5. Password verification
      const storedPassword = await this.userRepository.getUserPasswordHash(user.id);
      if (!storedPassword) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const isPasswordValid = await bcrypt.compare(data.password, storedPassword);

      if (!isPasswordValid) {
        // Increment attempt counter
        const newAttemptCount = (user.failedLoginAttempts ?? 0) + 1;

        if (newAttemptCount >= maxAttempts) {
          // Threshold reached → lock the account
          const lockedUntil = new Date(Date.now() + lockoutSeconds * 1000);
          await this.userRepository.updateUserLockout(user.id, {
            failedLoginAttempts: newAttemptCount,
            lockedUntil,
          });
          await this.emitSecurityEvent(SecurityEventType.LOGIN_FAILED, user.id, data, {
            reason: 'invalid_password',
            attemptCount: newAttemptCount,
          });
          await this.emitSecurityEvent(SecurityEventType.ACCOUNT_LOCKED, user.id, data, {
            lockedUntil: lockedUntil.toISOString(),
          });
        } else {
          await this.userRepository.updateUserLockout(user.id, {
            failedLoginAttempts: newAttemptCount,
            lockedUntil: null,
          });
          await this.emitSecurityEvent(SecurityEventType.LOGIN_FAILED, user.id, data, {
            reason: 'invalid_password',
            attemptCount: newAttemptCount,
          });
        }

        throw new UnauthorizedError('Invalid email or password');
      }

      // 6. Successful auth — reset lockout counters
      await this.userRepository.resetUserLockout(user.id);

      // 6.5 MFA step-up: if MFA is enabled, issue challenge token and stop here
      if (this.mfaChallengeStore) {
        const mfaData = await this.userRepository.getMfaData(user.id);
        if (mfaData?.mfaEnabled) {
          const challengeId = crypto.randomUUID();
          await this.mfaChallengeStore.save(challengeId, user.id, MFA_CHALLENGE_TTL_SECONDS);

          const jwtSecret = process.env.JWT_SECRET!;
          const mfaChallengeToken = jwt.sign(
            {
              userId: user.id,
              challengeId,
              type: TOKEN_TYPES.MFA_CHALLENGE,
            },
            jwtSecret,
            { expiresIn: MFA_CHALLENGE_TTL_SECONDS },
          );

          await this.emitSecurityEvent(SecurityEventType.MFA_CHALLENGE_ISSUED, user.id, data, {
            challengeId,
          });

          this.logger.info('MFA challenge issued — awaiting TOTP verification', {
            userId: user.id,
            challengeId,
          });

          return { mfaRequired: true, mfaChallengeToken };
        }
      }

      // 7. Resolve RBAC groups + permissions (with legacy fallback for pre-backfill users)
      const effective = await this.effectivePermissionsResolver.resolveForUser(user.id);

      let permissions: string[];
      let groups: string[];

      if (effective.groupCodes.length === 0) {
        permissions = resolvePermissions(user.role) as unknown as string[];
        groups = [];
        this.logger.warn('User has no RBAC groups, using legacy role-based permissions', {
          userId: user.id,
          role: user.role,
        });
      } else {
        permissions = effective.permissionCodes;
        groups = effective.groupCodes;
      }

      // 8. Generate JWT tokens
      const jwtSecret = process.env.JWT_SECRET!;
      const accessToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          groups,
          permissions,
        },
        jwtSecret,
        { expiresIn: '1h' },
      );

      const refreshToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          type: TOKEN_TYPES.REFRESH,
        },
        jwtSecret,
        { expiresIn: '7d' },
      );

      // 9. Create user session
      const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
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

      // 10. Session analytics — geoip lookup (offline, never blocks auth)
      try {
        const geo = this.geoIpPort.lookup(data.ipAddress);
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
          country: geo.country,
          city: geo.city,
        });
      } catch (analyticsError) {
        this.logger.warn('Failed to create session analytics', {
          userId: user.id,
          sessionId: session.sessionToken,
          operation: 'AuthenticateUser',
          error: analyticsError instanceof Error ? analyticsError.message : 'Unknown error',
        });
      }

      // 11. Update last login time
      await this.userRepository.updateUserLastLogin(user.id);

      // 12. Emit LOGIN_SUCCESS
      await this.emitSecurityEvent(SecurityEventType.LOGIN_SUCCESS, user.id, data, {
        groups,
        mfaEnabled: false,
      });

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

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async emitSecurityEvent(
    eventType: SecurityEventType,
    userId: string | undefined,
    request: AuthenticateUserRequest,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.securityEventRepository.create({
        userId,
        eventType,
        description: `Login event: ${eventType}`,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        metadata,
      });
    } catch (err) {
      // Security events are best-effort — never fail the login flow for audit failures
      this.logger.error('Failed to emit security event', err as Error, { eventType, userId });
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
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile';
    if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
    return 'desktop';
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
}
