import { LoggerFactory, type ILogger } from '@hbs/logging';
import type { IAuthzRepository, PaginationInput } from '../../../domain/repositories/IAuthzRepository';
import type { AuthRecordRule } from '@prisma/client';

export class ListRecordRulesUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('ListRecordRulesUseCase');
  }

  async execute(
    filter: { modelName?: string },
    pagination: PaginationInput,
  ): Promise<{ items: AuthRecordRule[]; total: number }> {
    const result = await this.repo.listRecordRules(filter, {
      limit: pagination.limit ?? 50,
      offset: pagination.offset ?? 0,
    });
    this.logger.info('Record rules listed', {
      modelName: filter.modelName,
      total: result.total,
      returned: result.items.length,
    });
    return result;
  }
}
