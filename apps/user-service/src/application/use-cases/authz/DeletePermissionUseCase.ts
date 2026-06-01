import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError, BusinessLogicError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';

export class DeletePermissionUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeletePermissionUseCase');
  }

  async execute(id: string): Promise<void> {
    const permission = await this.repo.findPermissionById(id);
    if (!permission) {
      throw new NotFoundError('Permission', id);
    }

    const usageCount = await this.repo.countPermissionUsage(id);
    if (usageCount > 0) {
      throw new BusinessLogicError(
        `Cannot delete permission '${permission.code}': it is assigned to ${usageCount} group(s). Revoke all group assignments first.`,
      );
    }

    await this.repo.deletePermission(id);
    this.logger.info('Permission deleted', { permissionId: id, code: permission.code });
  }
}
