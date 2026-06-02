import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IEmailService } from '../../../domain/interfaces/IEmailService';
import { ISecurityEventRepository } from '../../../domain/repositories/ISecurityEventRepository';
import { ILogger } from '@hbs/logging';
import { SecurityEventType } from '../../../domain/entities/Audit';
import { ValidationError } from '../../../domain/errors/DomainError';
import { TOKEN_TYPES } from '@hbs/auth';
import jwt from 'jsonwebtoken';

const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const EMAIL_VERIFICATION_COOLDOWN_SECONDS = 5 * 60;  // Bug #6 fix: min resend interval (5 min)

export interface RequestEmailVerificationRequest {
  email: string;
}

export interface RequestEmailVerificationResponse {
  email: string;
  timestamp: string;
}

export class RequestEmailVerificationUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly securityEventRepository: ISecurityEventRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(data: RequestEmailVerificationRequest): Promise<RequestEmailVerificationResponse> {
    this.logger.info('Starting email verification request', { email: data.email });

    // Normalize email
    const email = data.email.trim().toLowerCase();

    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new ValidationError('Invalid email format', 'INVALID_EMAIL_FORMAT');
    }

    const timestamp = new Date().toISOString();

    // Anti user-enumeration: always respond success regardless of existence
    const user = await this.userRepository.getUserByEmail(email);
    if (!user) {
      this.logger.warn('Email verification requested for non-existent email', { email });
      return { email, timestamp };
    }

    if (user.emailVerified) {
      this.logger.info('Email already verified, skipping verification email', {
        userId: user.id,
        email,
      });
      return { email, timestamp };
    }

    // Bug #6 fix: enforce a minimum resend cooldown to prevent email spam.
    // If a non-expired token was issued less than 5 minutes ago, return success
    // idempotently without sending a new email.
    const existingVerification = await this.userRepository.getEmailVerificationData(user.id);
    if (existingVerification?.token && existingVerification.expiresAt) {
      const isNotExpired = existingVerification.expiresAt > new Date();
      if (isNotExpired) {
        // Decode iat from the stored JWT (no verify needed — we issued it ourselves)
        let issuedAt: number | undefined;
        try {
          const decoded = jwt.decode(existingVerification.token) as { iat?: number } | null;
          issuedAt = decoded?.iat;
        } catch {
          // decode failure: treat as if no prior token — fall through to re-issue
        }

        if (issuedAt !== undefined) {
          const secondsSinceIssued = Math.floor(Date.now() / 1000) - issuedAt;
          if (secondsSinceIssued < EMAIL_VERIFICATION_COOLDOWN_SECONDS) {
            this.logger.info('Email verification cooldown active — skipping resend', {
              userId: user.id,
              email,
              secondsRemaining: EMAIL_VERIFICATION_COOLDOWN_SECONDS - secondsSinceIssued,
            });
            return { email, timestamp };
          }
        }
      }
    }

    const jwtSecret = process.env.JWT_SECRET!;
    const token = jwt.sign(
      {
        userId: user.id,
        email,
        type: TOKEN_TYPES.EMAIL_VERIFICATION,
      },
      jwtSecret,
      { expiresIn: EMAIL_VERIFICATION_TTL_SECONDS },
    );

    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_SECONDS * 1000);

    // Persist token + expiry in UserProfile
    await this.userRepository.setEmailVerificationToken(user.id, { token, expiresAt });

    // Emit security event (best-effort)
    try {
      await this.securityEventRepository.create({
        userId: user.id,
        eventType: SecurityEventType.EMAIL_VERIFICATION_REQUESTED,
        description: 'Email verification requested',
        metadata: { email },
      });
    } catch (err) {
      this.logger.warn('Failed to emit security event for email verification request', {
        userId: user.id,
        email,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Send email (best-effort — never block the response)
    const verifyBaseUrl =
      process.env.VERIFY_EMAIL_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000/verify-email';
    const verifyUrl = `${verifyBaseUrl}?token=${token}`;
    const userName = user.profile?.firstName || 'Usuario';

    try {
      await this.emailService.sendEmailVerificationEmail(email, token, userName, verifyUrl);
    } catch (emailErr) {
      // Best-effort: log warn, do NOT block caller
      this.logger.warn('Failed to send email verification email — token was stored', {
        userId: user.id,
        email,
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    this.logger.info('Email verification request completed', {
      userId: user.id,
      email,
      expiresAt: expiresAt.toISOString(),
    });

    return { email, timestamp };
  }
}
