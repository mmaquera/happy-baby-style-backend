import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IAuthRepository } from '../../../domain/repositories/IAuthRepository';
import { ISecurityEventRepository } from '../../../domain/repositories/ISecurityEventRepository';
import { IMfaChallengeStore } from '../../../domain/ports/IMfaChallengeStore';
import { IEffectivePermissionsResolver } from '../../../domain/interfaces/IEffectivePermissionsResolver';
import { ILogger } from '@hbs/logging';
import { ValidationError, UnauthorizedError, NotFoundError } from '../../../domain/errors/DomainError';
import { SecurityEventType } from '../../../domain/entities/Audit';
import { TOKEN_TYPES, resolvePermissions, decryptMfaSecret } from '@hbs/auth';
import { User } from '../../../domain/entities/User';
import { verifySync } from 'otplib';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const MAX_TOTP_ATTEMPTS = 3;
const BACKUP_CODE_REGEX = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export interface VerifyTotpRequest {
  mfaChallengeToken: string;
  code: string; // 6-digit TOTP or XXXX-XXXX-XXXX backup code
}

export interface VerifyTotpResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  session: {
    id: string;
    expiresAt: string;
  };
}

export class VerifyTotpUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly authRepository: IAuthRepository,
    private readonly securityEventRepository: ISecurityEventRepository,
    private readonly mfaChallengeStore: IMfaChallengeStore,
    private readonly effectivePermissionsResolver: IEffectivePermissionsResolver,
    private readonly logger: ILogger,
  ) {}

  async execute(data: VerifyTotpRequest): Promise<VerifyTotpResponse> {
    this.logger.info('Processing MFA challenge verification');

    if (!data.mfaChallengeToken || !data.code) {
      throw new ValidationError('mfaChallengeToken and code are required', 'INVALID_INPUT');
    }

    const jwtSecret = process.env.JWT_SECRET!;

    // G-2: verify JWT + type check
    let payload: any;
    try {
      payload = jwt.verify(data.mfaChallengeToken, jwtSecret) as any;
    } catch (jwtErr) {
      this.logger.warn('Invalid MFA challenge token', {
        error: jwtErr instanceof Error ? jwtErr.message : 'JWT error',
      });
      // G-1: generic message
      throw new UnauthorizedError('Invalid email or password');
    }

    if (payload.type !== TOKEN_TYPES.MFA_CHALLENGE) {
      this.logger.warn('Wrong token type presented for MFA challenge', {
        tokenType: payload.type,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    const { userId, challengeId } = payload as { userId: string; challengeId: string; type: string };

    // Bug #1 fix: Increment the attempt counter BEFORE consuming/validating.
    // This preserves the full 3-attempt window for typos / clock-drift.
    // The challenge key is only consumed (deleted) after the code is verified
    // as correct (or after the max-attempt threshold is breached).
    const attempts = await this.mfaChallengeStore.incrAttempts(challengeId);
    if (attempts > MAX_TOTP_ATTEMPTS) {
      await this.mfaChallengeStore.del(challengeId);
      await this.emitSecurityEvent(SecurityEventType.MFA_CHALLENGE_FAILED, userId, {
        reason: 'max_attempts_exceeded',
        challengeId,
        attempts,
      });
      this.logger.warn('MFA challenge invalidated: max attempts exceeded', {
        userId,
        challengeId,
        attempts,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    // Load user + MFA data before validating the code
    const user = await this.userRepository.getUserById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const mfaData = await this.userRepository.getMfaData(userId);
    if (!mfaData?.mfaEnabled || !mfaData.mfaSecret) {
      throw new NotFoundError('MFA configuration', userId);
    }

    // Discriminate: 6-digit TOTP vs XXXX-XXXX-XXXX backup code
    const isBackupCode = BACKUP_CODE_REGEX.test(data.code);
    // matchedBackupCodeIndex is set during backup-code validation; used after
    // session creation to defer the DB removal until the session succeeds (Bug #4 fix).
    let matchedBackupCodeIndex = -1;

    if (!isBackupCode) {
      // --- TOTP path ---
      let plainSecret: string;
      try {
        // G-4: decrypt just before use
        plainSecret = decryptMfaSecret(mfaData.mfaSecret);
      } catch (decErr) {
        this.logger.error('Failed to decrypt MFA secret during TOTP verification', decErr as Error, {
          userId,
        });
        throw new UnauthorizedError('Invalid email or password');
      }

      // otplib 13.x: verifySync returns VerifyResult { valid: boolean, ... }
      const result = verifySync({ token: data.code, secret: plainSecret });
      const isValid = (result as any)?.valid === true;
      // G-3: never log plainSecret

      if (!isValid) {
        await this.emitSecurityEvent(SecurityEventType.MFA_CHALLENGE_FAILED, userId, {
          reason: 'invalid_totp',
          challengeId,
          attempt: attempts,
        });
        this.logger.warn('Invalid TOTP code', { userId, attempt: attempts });
        throw new UnauthorizedError('Invalid email or password');
      }
    } else {
      // --- Backup code path ---
      for (let i = 0; i < mfaData.mfaBackupCodes.length; i++) {
        const matches = await bcrypt.compare(data.code, mfaData.mfaBackupCodes[i]);
        if (matches) {
          matchedBackupCodeIndex = i;
          break;
        }
      }

      if (matchedBackupCodeIndex === -1) {
        await this.emitSecurityEvent(SecurityEventType.MFA_CHALLENGE_FAILED, userId, {
          reason: 'invalid_backup_code',
          challengeId,
          attempt: attempts,
        });
        this.logger.warn('Invalid backup code', { userId, attempt: attempts });
        throw new UnauthorizedError('Invalid email or password');
      }
      // NOTE: backup code DB removal is deferred until AFTER session creation (Bug #4 fix).
    }

    // Bug #1 fix (continued): consume the Redis challenge ONLY after the code is verified.
    // All failure paths above throw, keeping the challenge alive for the remaining attempts.
    // G-7: atomic GET+DEL and verify userId binding
    const boundUserId = await this.mfaChallengeStore.consume(challengeId);
    if (!boundUserId) {
      this.logger.warn('MFA challenge not found or already consumed', {
        userId,
        challengeId,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    if (boundUserId !== userId) {
      this.logger.warn('MFA challenge userId binding mismatch — possible token substitution attack', {
        tokenUserId: userId,
        storeUserId: boundUserId,
        challengeId,
      });
      await this.emitSecurityEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, userId, {
        reason: 'mfa_challenge_userId_mismatch',
        challengeId,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    // Resolve RBAC groups + permissions
    const effective = await this.effectivePermissionsResolver.resolveForUser(userId);

    let permissions: string[];
    let groups: string[];

    if (effective.groupCodes.length === 0) {
      permissions = resolvePermissions(user.role) as unknown as string[];
      groups = [];
      this.logger.warn('User has no RBAC groups, using legacy role-based permissions', {
        userId,
        role: user.role,
      });
    } else {
      permissions = effective.permissionCodes;
      groups = effective.groupCodes;
    }

    // Issue final access + refresh tokens
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

    // Create session
    const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await this.authRepository.createSession({
      userId: user.id,
      sessionToken: crypto.randomUUID(),
      accessToken,
      refreshToken,
      expiresAt: sessionExpiresAt,
      isActive: true,
    });

    // Bug #4 fix: Remove the consumed backup code AFTER session creation succeeds.
    // If createSession had failed (DB error), the code is NOT burned — user can retry.
    if (isBackupCode && matchedBackupCodeIndex !== -1) {
      const updatedCodes = mfaData.mfaBackupCodes.filter((_, idx) => idx !== matchedBackupCodeIndex);
      await this.userRepository.enableMfa(userId, updatedCodes);

      await this.emitSecurityEvent(SecurityEventType.MFA_BACKUP_CODE_USED, userId, {
        remainingCodes: updatedCodes.length,
        challengeId,
      });

      if (updatedCodes.length === 0) {
        await this.emitSecurityEvent(SecurityEventType.MFA_LAST_BACKUP_CODE_USED, userId, {
          challengeId,
        });
        this.logger.warn('Last MFA backup code consumed — user should regenerate backup codes', {
          userId,
        });
      }
    }

    // Emit success event
    await this.emitSecurityEvent(SecurityEventType.MFA_CHALLENGE_SUCCEEDED, userId, {
      method: isBackupCode ? 'backup_code' : 'totp',
      challengeId,
    });

    await this.userRepository.updateUserLastLogin(user.id);

    this.logger.info('MFA challenge completed — tokens issued', {
      userId,
      method: isBackupCode ? 'backup_code' : 'totp',
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
  }

  private async emitSecurityEvent(
    eventType: SecurityEventType,
    userId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.securityEventRepository.create({
        userId,
        eventType,
        description: `MFA event: ${eventType}`,
        metadata,
      });
    } catch (err) {
      this.logger.error('Failed to emit MFA security event', err as Error, { eventType, userId });
    }
  }
}
