import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';
import type { GroupPermission } from '@prisma/client';

export class ListGroupPermissionsUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('ListGroupPermissionsUseCase');
  }

  async execute(groupId: string): Promise<GroupPermission[]> {
    const group = await this.repo.findGroupById(groupId);
    if (!group) {
      throw new NotFoundError('Group', groupId);
    }

    const permissions = await this.repo.listGroupPermissions(groupId);
    this.logger.info('Group permissions listed', { groupId, count: permissions.length });
    return permissions;
  }
}
