import { LoggerFactory, type ILogger } from '@hbs/logging';
import { ValidationError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';
import type { AuthPermission } from '@prisma/client';

export class CreatePermissionUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreatePermissionUseCase');
  }

  async execute(input: {
    code: string;
    name: string;
    description?: string;
    category: string;
  }): Promise<AuthPermission> {
    if (!input.code || !/^[a-z][a-z0-9:_-]+$/.test(input.code)) {
      throw new ValidationError(
        'Permission code must be lowercase, e.g. "create:product"',
        'code',
      );
    }
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Permission name is required', 'name');
    }
    if (!input.category || input.category.trim().length === 0) {
      throw new ValidationError('Permission category is required', 'category');
    }

    const existing = await this.repo.findPermissionByCode(input.code);
    if (existing) {
      throw new ValidationError(`Permission code '${input.code}' already exists`, 'code');
    }

    const permission = await this.repo.createPermission({
      code: input.code.trim(),
      name: input.name.trim(),
      description: input.description?.trim(),
      category: input.category.trim(),
    });

    this.logger.info('Permission created', { permissionId: permission.id, code: permission.code });
    return permission;
  }
}
