import { LoggerFactory, type ILogger } from '@hbs/logging';
import { ValidationError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';
import type { AuthGroupEntity } from '../../../domain/entities/Authz';

export class CreateGroupUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateGroupUseCase');
  }

  async execute(input: { code: string; name: string; description?: string }): Promise<AuthGroupEntity> {
    if (!input.code || !/^[a-z][a-z0-9-]+$/.test(input.code)) {
      throw new ValidationError('Group code must be lowercase kebab-case starting with a letter', 'code');
    }
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Group name is required', 'name');
    }

    const existing = await this.repo.findGroupByCode(input.code);
    if (existing) {
      throw new ValidationError(`Group code '${input.code}' already exists`, 'code');
    }

    const group = await this.repo.createGroup({
      code: input.code.trim(),
      name: input.name.trim(),
      description: input.description?.trim(),
    });

    this.logger.info('Group created', { groupId: group.id, code: group.code });
    return group;
  }
}
