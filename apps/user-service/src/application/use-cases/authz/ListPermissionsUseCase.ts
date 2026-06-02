import { LoggerFactory, type ILogger } from '@hbs/logging';
import type { IAuthzRepository, PaginationInput } from '../../../domain/repositories/IAuthzRepository';
import type { AuthPermissionEntity } from '../../../domain/entities/Authz';

export class ListPermissionsUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('ListPermissionsUseCase');
  }

  async execute(pagination: PaginationInput): Promise<{ items: AuthPermissionEntity[]; total: number }> {
    const result = await this.repo.listPermissions({
      limit: pagination.limit ?? 50,
      offset: pagination.offset ?? 0,
    });
    this.logger.info('Permissions listed', { total: result.total, returned: result.items.length });
    return result;
  }
}
