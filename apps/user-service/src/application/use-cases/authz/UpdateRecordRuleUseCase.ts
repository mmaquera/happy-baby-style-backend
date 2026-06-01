import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError, ValidationError } from '@hbs/shared-kernel';
import { DomainExprSchema } from '@hbs/authz';
import { ZodError } from 'zod';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';
import type { IRecordRulesEventPublisher } from '../../ports/IRecordRulesEventPublisher';
import type { AuthRecordRule } from '@prisma/client';

export class UpdateRecordRuleUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly repo: IAuthzRepository,
    private readonly publisher: IRecordRulesEventPublisher,
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateRecordRuleUseCase');
  }

  async execute(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      modelName: string;
      groupId: string | null;
      mode: 'read' | 'write' | 'create' | 'unlink';
      domainExpression: unknown;
      isActive: boolean;
    }>,
  ): Promise<AuthRecordRule> {
    const rule = await this.repo.findRecordRuleById(id);
    if (!rule) {
      throw new NotFoundError('RecordRule', id);
    }

    // Validate domainExpression if provided.
    if (input.domainExpression !== undefined) {
      try {
        DomainExprSchema.parse(input.domainExpression);
      } catch (err) {
        if (err instanceof ZodError) {
          const issues = (err as any).issues ?? (err as any).errors ?? [];
          const details = issues.map((e: any) => `${(e.path ?? []).join('.')}: ${e.message}`).join('; ');
          throw new ValidationError(
            `Invalid domainExpression: ${details || err.message}`,
            'domainExpression',
          );
        }
        throw err;
      }
    }

    const updated = await this.repo.updateRecordRule(id, input);
    this.logger.info('Record rule updated', { ruleId: updated.id, modelName: updated.modelName });

    // Resolve groupCode for the event payload (consumers need code, not id).
    let groupCode: string | null = null;
    if (updated.groupId) {
      const group = await this.repo.findGroupById(updated.groupId);
      groupCode = group?.code ?? null;
    }

    // Publish full snapshot event — fire and log on failure.
    try {
      await this.publisher.publish({
        eventType: 'rule.updated',
        ruleId: updated.id,
        rule: {
          id: updated.id,
          name: updated.name,
          modelName: updated.modelName,
          groupCode,
          mode: updated.mode as 'read' | 'write' | 'create' | 'unlink',
          domainExpression: updated.domainExpression,
          isActive: updated.isActive,
        },
      });
    } catch (err) {
      this.logger.error(
        'Failed to publish record-rule updated event — consuming caches may be stale',
        err as Error,
        { ruleId: updated.id, modelName: updated.modelName },
      );
    }

    return updated;
  }
}
