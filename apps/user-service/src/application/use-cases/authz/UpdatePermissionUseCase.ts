import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';
import type { AuthPermissionEntity } from '../../../domain/entities/Authz';

export class UpdatePermissionUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdatePermissionUseCase');
  }

  async execute(
    id: string,
    input: { name?: string; description?: string; category?: string },
  ): Promise<AuthPermissionEntity> {
    const permission = await this.repo.findPermissionById(id);
    if (!permission) {
      throw new NotFoundError('Permission', id);
    }

    const updated = await this.repo.updatePermission(id, input);
    this.logger.info('Permission updated', { permissionId: updated.id, code: updated.code });
    return updated;
  }
}
