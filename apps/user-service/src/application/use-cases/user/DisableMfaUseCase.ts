import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ISecurityEventRepository } from '../../../domain/repositories/ISecurityEventRepository';
import { ILogger } from '@hbs/logging';
import {
  NotFoundError,
  ValidationError,
  BusinessLogicError,
} from '../../../domain/errors/DomainError';
import { SecurityEventType } from '../../../domain/entities/Audit';
import bcrypt from 'bcryptjs';

export interface DisableMfaRequest {
  userId: string;
  password: string; // current password — required to confirm intent
}

export class DisableMfaUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly securityEventRepository: ISecurityEventRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(data: DisableMfaRequest): Promise<void> {
    this.logger.info('Attempting to disable MFA', { userId: data.userId });

    if (!data.password) {
      throw new ValidationError('Current password is required to disable MFA', 'PASSWORD_REQUIRED');
    }

    const mfaData = await this.userRepository.getMfaData(data.userId);
    if (!mfaData) {
      throw new NotFoundError('User', data.userId);
    }

    if (!mfaData.mfaEnabled) {
      throw new BusinessLogicError('MFA is not enabled for this account');
    }

    // Verify current password
    const storedHash = await this.userRepository.getUserPasswordHash(data.userId);
    if (!storedHash) {
      throw new ValidationError('Invalid password', 'INVALID_PASSWORD');
    }

    const isPasswordValid = await bcrypt.compare(data.password, storedHash);
    if (!isPasswordValid) {
      this.logger.warn('Invalid password provided when attempting to disable MFA', {
        userId: data.userId,
      });
      throw new ValidationError('Invalid password', 'INVALID_PASSWORD');
    }

    // Clear MFA state
    await this.userRepository.disableMfa(data.userId);

    // Emit security event (best-effort)
    try {
      await this.securityEventRepository.create({
        userId: data.userId,
        eventType: SecurityEventType.MFA_DISABLED,
        description: 'MFA disabled by user after password confirmation',
        metadata: {},
      });
    } catch (err) {
      this.logger.warn('Failed to emit MFA_DISABLED security event', {
        userId: data.userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    this.logger.info('MFA disabled successfully', { userId: data.userId });
  }
}
