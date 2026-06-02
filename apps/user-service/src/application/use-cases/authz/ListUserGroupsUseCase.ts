import { LoggerFactory, type ILogger } from '@hbs/logging';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';
import type { UserGroupEntity } from '../../../domain/entities/Authz';

export class ListUserGroupsUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('ListUserGroupsUseCase');
  }

  async execute(userId: string): Promise<UserGroupEntity[]> {
    const groups = await this.repo.listUserGroups(userId);
    this.logger.info('User groups listed', { userId, count: groups.length });
    return groups;
  }
}
