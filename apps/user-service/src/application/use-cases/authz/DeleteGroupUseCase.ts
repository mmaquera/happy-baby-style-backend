import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError, BusinessLogicError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';

export class DeleteGroupUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteGroupUseCase');
  }

  async execute(id: string): Promise<void> {
    const group = await this.repo.findGroupById(id);
    if (!group) {
      throw new NotFoundError('Group', id);
    }

    if (group.isSystem) {
      throw new BusinessLogicError(
        `Cannot delete system group '${group.code}' — system groups are seed-protected`,
      );
    }

    const relations = await this.repo.countGroupRelations(id);
    const total = relations.users + relations.permissions + relations.implications + relations.recordRules;
    if (total > 0) {
      throw new BusinessLogicError(
        `Cannot delete group '${group.code}': it has ${relations.users} user(s), ` +
          `${relations.permissions} permission(s), ${relations.implications} implication(s), ` +
          `and ${relations.recordRules} record rule(s). Remove all associations first.`,
      );
    }

    await this.repo.deleteGroup(id);
    this.logger.info('Group deleted', { groupId: id, code: group.code });
  }
}
