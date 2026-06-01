import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';

export class RemoveUserFromGroupUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('RemoveUserFromGroupUseCase');
  }

  async execute(userId: string, groupId: string): Promise<void> {
    const membership = await this.repo.findUserGroup(userId, groupId);
    if (!membership) {
      throw new NotFoundError('UserGroup', `${userId}:${groupId}`);
    }

    await this.repo.removeUserFromGroup(userId, groupId);
    this.logger.info('User removed from group', { userId, groupId });
  }
}
