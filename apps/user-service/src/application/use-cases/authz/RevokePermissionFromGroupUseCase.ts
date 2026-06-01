import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';

export class RevokePermissionFromGroupUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('RevokePermissionFromGroupUseCase');
  }

  async execute(groupId: string, permissionId: string): Promise<void> {
    const link = await this.repo.findGroupPermission(groupId, permissionId);
    if (!link) {
      throw new NotFoundError('GroupPermission', `${groupId}:${permissionId}`);
    }

    await this.repo.revokePermissionFromGroup(groupId, permissionId);
    this.logger.info('Permission revoked from group', { groupId, permissionId });
  }
}
