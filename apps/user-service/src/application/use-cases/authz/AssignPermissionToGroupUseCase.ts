import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';
import type { GroupPermission } from '@prisma/client';

export class AssignPermissionToGroupUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('AssignPermissionToGroupUseCase');
  }

  async execute(groupId: string, permissionId: string): Promise<GroupPermission> {
    const group = await this.repo.findGroupById(groupId);
    if (!group) {
      throw new NotFoundError('Group', groupId);
    }

    const permission = await this.repo.findPermissionById(permissionId);
    if (!permission) {
      throw new NotFoundError('Permission', permissionId);
    }

    // Idempotent: if assignment already exists, return existing record.
    const existing = await this.repo.findGroupPermission(groupId, permissionId);
    if (existing) {
      this.logger.info('Permission already assigned to group — idempotent', {
        groupId,
        permissionId,
      });
      return existing;
    }

    const link = await this.repo.assignPermissionToGroup(groupId, permissionId);
    this.logger.info('Permission assigned to group', {
      groupId,
      permissionId,
      groupCode: group.code,
      permissionCode: permission.code,
    });
    return link;
  }
}
