import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { ISecurityEventRepository } from '../../../domain/repositories/ISecurityEventRepository';
import { ILogger } from '@hbs/logging';
import { SecurityEventType } from '../../../domain/entities/Audit';
import { NotFoundError } from '../../../domain/errors/DomainError';

export interface UnlockUserAccountRequest {
  targetUserId: string;
  adminUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UnlockUserAccountResponse {
  success: boolean;
  userId: string;
}

export class UnlockUserAccountUseCase {
  constructor(
    private userRepository: IUserRepository,
    private securityEventRepository: ISecurityEventRepository,
    private logger: ILogger,
  ) {}

  async execute(data: UnlockUserAccountRequest): Promise<UnlockUserAccountResponse> {
    this.logger.info('Unlocking user account', {
      targetUserId: data.targetUserId,
      adminUserId: data.adminUserId,
    });

    const user = await this.userRepository.getUserById(data.targetUserId);
    if (!user) {
      throw new NotFoundError('User', data.targetUserId);
    }

    await this.userRepository.resetUserLockout(data.targetUserId);

    try {
      await this.securityEventRepository.create({
        userId: data.targetUserId,
        eventType: SecurityEventType.ACCOUNT_UNLOCKED,
        description: `Account unlocked by admin ${data.adminUserId}`,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: { adminUserId: data.adminUserId },
      });
    } catch (err) {
      this.logger.error('Failed to emit ACCOUNT_UNLOCKED event', err as Error, {
        targetUserId: data.targetUserId,
      });
    }

    this.logger.info('User account unlocked successfully', {
      targetUserId: data.targetUserId,
      adminUserId: data.adminUserId,
    });

    return { success: true, userId: data.targetUserId };
  }
}
