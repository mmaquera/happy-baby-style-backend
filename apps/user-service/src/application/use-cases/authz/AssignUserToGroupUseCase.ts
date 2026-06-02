import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError, ValidationError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';
import type { UserGroupEntity } from '../../../domain/entities/Authz';

export class AssignUserToGroupUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('AssignUserToGroupUseCase');
  }

  async execute(input: {
    userId: string;
    groupId: string;
    grantedBy?: string;
  }): Promise<UserGroupEntity> {
    const group = await this.repo.findGroupById(input.groupId);
    if (!group) {
      throw new NotFoundError('Group', input.groupId);
    }

    // Idempotent: if membership already exists, return existing record.
    const existing = await this.repo.findUserGroup(input.userId, input.groupId);
    if (existing) {
      this.logger.info('User already assigned to group — idempotent', {
        userId: input.userId,
        groupId: input.groupId,
      });
      return existing;
    }

    const membership = await this.repo.assignUserToGroup(input);
    this.logger.info('User assigned to group', {
      userId: input.userId,
      groupId: input.groupId,
      grantedBy: input.grantedBy,
    });
    return membership;
  }
}
