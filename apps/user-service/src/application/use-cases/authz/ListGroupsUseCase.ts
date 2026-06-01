import { LoggerFactory, type ILogger } from '@hbs/logging';
import type { IAuthzRepository, PaginationInput } from '../../../domain/repositories/IAuthzRepository';
import type { AuthGroup } from '@prisma/client';

export class ListGroupsUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('ListGroupsUseCase');
  }

  async execute(pagination: PaginationInput): Promise<{ items: AuthGroup[]; total: number }> {
    const result = await this.repo.listGroups({
      limit: pagination.limit ?? 50,
      offset: pagination.offset ?? 0,
    });
    this.logger.info('Groups listed', { total: result.total, returned: result.items.length });
    return result;
  }
}
