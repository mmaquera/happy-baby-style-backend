import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';

export class RemoveGroupImplicationUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('RemoveGroupImplicationUseCase');
  }

  async execute(groupId: string, impliedGroupId: string): Promise<void> {
    const implication = await this.repo.findImplication(groupId, impliedGroupId);
    if (!implication) {
      throw new NotFoundError('GroupImplication', `${groupId}:${impliedGroupId}`);
    }

    await this.repo.removeGroupImplication(groupId, impliedGroupId);
    this.logger.info('Group implication removed', { groupId, impliedGroupId });
  }
}
