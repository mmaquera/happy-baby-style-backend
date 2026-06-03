import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { IAuditRepository } from '@domain/repositories/IAuditRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { NotFoundError, ValidationError } from '@domain/errors/DomainError';
import { AuditAction } from '@domain/entities/Audit';
import { ILogger } from '@hbs/logging';

export interface ForcePasswordResetRequest {
  /** The user whose password must be reset on next login */
  targetUserId: string;
  /** The admin performing this action (for audit trail) */
  adminUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ForcePasswordResetResponse {
  targetUserId: string;
  forcedAt: Date;
}

/**
 * ForcePasswordResetUseCase
 *
 * Sets mustChangePasswordAt = now() on the target user's UserPassword record.
 * On the next login attempt, AuthenticateUserUseCase will detect this flag and
 * return a FORCE_PASSWORD_RESET error instead of issuing a normal JWT.
 *
 * Guarded at the resolver level by requireAdministrator (administrators group).
 * Emits an audit log for traceability (who forced the reset, on whom, when).
 */
export class ForcePasswordResetUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly authRepository: IAuthRepository,
    private readonly auditRepository: IAuditRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(request: ForcePasswordResetRequest): Promise<ForcePasswordResetResponse> {
    if (!request.targetUserId) {
      throw new ValidationError('targetUserId is required', 'targetUserId');
    }
    if (!request.adminUserId) {
      throw new ValidationError('adminUserId is required', 'adminUserId');
    }

    this.logger.info('Forcing password reset', {
      targetUserId: request.targetUserId,
      adminUserId: request.adminUserId,
    });

    // Verify target user exists
    const targetUser = await this.userRepository.getUserById(request.targetUserId);
    if (!targetUser) {
      throw new NotFoundError('User', request.targetUserId);
    }

    const forcedAt = new Date();

    await this.authRepository.setMustChangePassword(request.targetUserId, forcedAt);

    // Audit trail: who forced the reset, on whom, and when.
    await this.auditRepository.create({
      userId: request.adminUserId,
      action: AuditAction.PASSWORD_RESET,
      tableName: 'user_passwords',
      recordId: request.targetUserId,
      oldValues: {},
      newValues: {
        mustChangePasswordAt: forcedAt.toISOString(),
        forcedBy: request.adminUserId,
      },
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });

    this.logger.info('Password reset forced — user must change password on next login', {
      targetUserId: request.targetUserId,
      adminUserId: request.adminUserId,
      forcedAt: forcedAt.toISOString(),
    });

    return { targetUserId: request.targetUserId, forcedAt };
  }
}
