import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ISecurityEventRepository } from '../../../domain/repositories/ISecurityEventRepository';
import { ILogger } from '@hbs/logging';
import { SecurityEventType } from '../../../domain/entities/Audit';
import { ValidationError, NotFoundError } from '../../../domain/errors/DomainError';
import { TOKEN_TYPES } from '@hbs/auth';
import jwt from 'jsonwebtoken';

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyEmailResponse {
  timestamp: string;
  emailVerified: boolean;
}

export class VerifyEmailUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly securityEventRepository: ISecurityEventRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(data: VerifyEmailRequest): Promise<VerifyEmailResponse> {
    this.logger.info('Starting email verification', { tokenLength: data.token?.length });

    if (!data.token) {
      throw new ValidationError('Verification token is required', 'TOKEN_REQUIRED');
    }

    const jwtSecret = process.env.JWT_SECRET!;
    let payload: any;

    // G-2: verify JWT and check type claim
    try {
      payload = jwt.verify(data.token, jwtSecret) as any;
    } catch (jwtErr) {
      this.logger.warn('Invalid JWT token for email verification', {
        error: jwtErr instanceof Error ? jwtErr.message : 'Unknown JWT error',
      });
      throw new ValidationError('Invalid or expired verification token', 'INVALID_TOKEN');
    }

    // G-2: type check — must be EMAIL_VERIFICATION
    if (payload.type !== TOKEN_TYPES.EMAIL_VERIFICATION) {
      this.logger.warn('Invalid token type for email verification', {
        tokenType: payload.type,
        userId: payload.userId,
      });
      throw new ValidationError('Invalid token type', 'INVALID_TOKEN_TYPE');
    }

    // Load verification data from DB
    const verificationData = await this.userRepository.getEmailVerificationData(payload.userId);
    if (!verificationData) {
      throw new NotFoundError('User', payload.userId);
    }

    if (verificationData.emailVerified) {
      this.logger.info('Email already verified', { userId: payload.userId });
      return { timestamp: new Date().toISOString(), emailVerified: true };
    }

    // Token must match exactly what is stored (single-use)
    if (!verificationData.token || verificationData.token !== data.token) {
      this.logger.warn('Token mismatch for email verification', {
        userId: payload.userId,
        hasStoredToken: !!verificationData.token,
      });
      throw new ValidationError('Invalid or expired verification token', 'INVALID_TOKEN');
    }

    // Check DB-level expiry (belt-and-suspenders on top of JWT exp)
    if (!verificationData.expiresAt || verificationData.expiresAt < new Date()) {
      this.logger.warn('Expired verification token', {
        userId: payload.userId,
        expiresAt: verificationData.expiresAt,
      });
      throw new ValidationError('Verification token has expired', 'TOKEN_EXPIRED');
    }

    // Mark verified + clear token (single-use)
    await this.userRepository.markEmailVerified(payload.userId);

    // Emit security event (best-effort)
    try {
      await this.securityEventRepository.create({
        userId: payload.userId,
        eventType: SecurityEventType.EMAIL_VERIFIED,
        description: 'Email address verified successfully',
        metadata: { email: payload.email },
      });
    } catch (err) {
      this.logger.warn('Failed to emit EMAIL_VERIFIED security event', {
        userId: payload.userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    this.logger.info('Email verification completed successfully', {
      userId: payload.userId,
      email: payload.email,
    });

    return { timestamp: new Date().toISOString(), emailVerified: true };
  }
}
