import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';
import type { IRecordRulesEventPublisher } from '../../ports/IRecordRulesEventPublisher';

export class DeleteRecordRuleUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly repo: IAuthzRepository,
    private readonly publisher: IRecordRulesEventPublisher,
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteRecordRuleUseCase');
  }

  async execute(id: string): Promise<void> {
    const rule = await this.repo.findRecordRuleById(id);
    if (!rule) {
      throw new NotFoundError('RecordRule', id);
    }

    // Capture modelName before deletion for the event payload.
    const { modelName } = rule;

    await this.repo.deleteRecordRule(id);
    this.logger.info('Record rule deleted', { ruleId: id, modelName });

    // Publish deleted event — no rule snapshot needed (consumer removes by ruleId).
    try {
      await this.publisher.publish({
        eventType: 'rule.deleted',
        ruleId: id,
        rule: null,
      });
    } catch (err) {
      this.logger.error(
        'Failed to publish record-rule deleted event — consuming caches may be stale',
        err as Error,
        { ruleId: id, modelName },
      );
    }
  }
}
