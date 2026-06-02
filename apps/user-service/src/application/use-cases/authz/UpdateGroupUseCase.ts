import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';
import type { AuthGroupEntity } from '../../../domain/entities/Authz';

export class UpdateGroupUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateGroupUseCase');
  }

  async execute(
    id: string,
    input: { name?: string; description?: string },
  ): Promise<AuthGroupEntity> {
    const group = await this.repo.findGroupById(id);
    if (!group) {
      throw new NotFoundError('Group', id);
    }

    // Policy: system groups may have their description updated but NOT name.
    // code is never updatable (it's the stable identifier).
    const updatePayload: { name?: string; description?: string } = {};

    if (input.description !== undefined) {
      updatePayload.description = input.description;
    }

    if (input.name !== undefined) {
      if (group.isSystem) {
        this.logger.warn('Attempted to rename system group — name update skipped', {
          groupId: id,
          code: group.code,
        });
        // Skip name update silently — only description allowed for system groups.
      } else {
        updatePayload.name = input.name.trim();
      }
    }

    const updated = await this.repo.updateGroup(id, updatePayload);
    this.logger.info('Group updated', { groupId: updated.id, code: updated.code });
    return updated;
  }
}
