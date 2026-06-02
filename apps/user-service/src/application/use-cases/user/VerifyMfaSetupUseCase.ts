import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ISecurityEventRepository } from '../../../domain/repositories/ISecurityEventRepository';
import { ILogger } from '@hbs/logging';
import { NotFoundError, ValidationError, BusinessLogicError } from '../../../domain/errors/DomainError';
import { SecurityEventType } from '../../../domain/entities/Audit';
import { decryptMfaSecret } from '@hbs/auth';
import { verifySync } from 'otplib';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const BACKUP_CODE_GROUP_LEN = 4;
const BACKUP_CODE_GROUPS = 3;
const MAX_SETUP_ATTEMPTS = 3;
const BCRYPT_ROUNDS = 10;

// In-memory attempt counter per userId (resets on process restart — acceptable for setup flow).
// Bug #2 fix: the counter is now cleared on BOTH success AND failure so that a user who
// exceeds the limit can restart MFA setup (enableMFA) and get a fresh attempt window.
// A new enableMFA call effectively resets the secret, which invalidates prior counters.
const setupAttempts = new Map<string, number>();

export interface VerifyMfaSetupRequest {
  userId: string;
  code: string;
}

export interface VerifyMfaSetupResponse {
  backupCodes: string[]; // plain-text, returned ONCE
  mfaEnabled: boolean;
}

function generateBackupCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < BACKUP_CODE_GROUPS; g++) {
    let group = '';
    for (let i = 0; i < BACKUP_CODE_GROUP_LEN; i++) {
      const idx = crypto.randomInt(0, BACKUP_CODE_CHARSET.length);
      group += BACKUP_CODE_CHARSET[idx];
    }
    groups.push(group);
  }
  return groups.join('-');
}

export class VerifyMfaSetupUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly securityEventRepository: ISecurityEventRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(data: VerifyMfaSetupRequest): Promise<VerifyMfaSetupResponse> {
    this.logger.info('Verifying MFA setup TOTP code', { userId: data.userId });

    // Enforce attempt limit per userId (anti-brute-force during setup)
    const currentAttempts = (setupAttempts.get(data.userId) ?? 0) + 1;
    setupAttempts.set(data.userId, currentAttempts);

    if (currentAttempts > MAX_SETUP_ATTEMPTS) {
      this.logger.warn('MFA setup attempt limit exceeded', {
        userId: data.userId,
        attempts: currentAttempts,
      });
      throw new BusinessLogicError('Maximum setup attempts exceeded. Please restart MFA setup.');
    }

    const mfaData = await this.userRepository.getMfaData(data.userId);
    if (!mfaData) {
      throw new NotFoundError('User', data.userId);
    }

    if (mfaData.mfaEnabled) {
      throw new BusinessLogicError('MFA is already enabled for this account');
    }

    if (!mfaData.mfaSecret) {
      throw new ValidationError('MFA setup not initiated. Call enableMFA first.', 'MFA_NOT_INITIATED');
    }

    // G-4: decrypt just before use; G-3: never log
    let plainSecret: string;
    try {
      plainSecret = decryptMfaSecret(mfaData.mfaSecret);
    } catch (decErr) {
      this.logger.error('Failed to decrypt MFA secret during setup verification', decErr as Error, {
        userId: data.userId,
      });
      throw new BusinessLogicError('MFA secret is corrupted. Please restart MFA setup.');
    }

    // Validate TOTP code using otplib 13.x functional API
    // verifySync returns VerifyResult: { valid: boolean, ... }
    const result = verifySync({ token: data.code, secret: plainSecret });
    const isValid = (result as any)?.valid === true;

    if (!isValid) {
      // Bug #2 fix: clear the attempt counter on failure so that restarting MFA setup
      // (calling enableMFA again which re-issues a new secret) gives a fresh window.
      // Without this, a failed attempt permanently incremented the counter, causing
      // permanent lockout even after the user called enableMFA again.
      setupAttempts.delete(data.userId);
      this.logger.warn('Invalid TOTP code during MFA setup', {
        userId: data.userId,
        attempt: currentAttempts,
        maxAttempts: MAX_SETUP_ATTEMPTS,
      });
      throw new ValidationError('Invalid verification code', 'INVALID_TOTP_CODE');
    }

    // Reset attempt counter on success
    setupAttempts.delete(data.userId);

    // G-5: Generate backup codes — plain text one time only
    const plainBackupCodes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      plainBackupCodes.push(generateBackupCode());
    }

    // G-5: Hash with bcrypt(10) before persisting
    const hashedCodes = await Promise.all(
      plainBackupCodes.map((code) => bcrypt.hash(code, BCRYPT_ROUNDS)),
    );

    // Atomically enable MFA + store hashed backup codes
    await this.userRepository.enableMfa(data.userId, hashedCodes);

    // Emit security event (best-effort)
    try {
      await this.securityEventRepository.create({
        userId: data.userId,
        eventType: SecurityEventType.MFA_ENABLED,
        description: 'MFA enabled via TOTP setup',
        metadata: { backupCodesCount: BACKUP_CODE_COUNT },
      });
    } catch (err) {
      this.logger.warn('Failed to emit MFA_ENABLED security event', {
        userId: data.userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    this.logger.info('MFA setup verified and enabled', {
      userId: data.userId,
      backupCodesCount: BACKUP_CODE_COUNT,
      // G-3: DO NOT log codes or secret
    });

    return {
      backupCodes: plainBackupCodes, // plain-text, returned ONCE
      mfaEnabled: true,
    };
  }
}
