import { LoggerFactory, type ILogger } from '@hbs/logging';
import { ValidationError } from '@hbs/shared-kernel';
import { DomainExprSchema } from '@hbs/authz';
import { ZodError } from 'zod';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';
import type { IRecordRulesEventPublisher } from '../../ports/IRecordRulesEventPublisher';
import type { AuthRecordRule } from '@prisma/client';

export class CreateRecordRuleUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly repo: IAuthzRepository,
    private readonly publisher: IRecordRulesEventPublisher,
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateRecordRuleUseCase');
  }

  async execute(input: {
    name: string;
    description?: string;
    modelName: string;
    groupId?: string;
    mode: 'read' | 'write' | 'create' | 'unlink';
    domainExpression: unknown;
    isActive?: boolean;
  }): Promise<AuthRecordRule> {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Record rule name is required', 'name');
    }
    if (!input.modelName || input.modelName.trim().length === 0) {
      throw new ValidationError('modelName is required', 'modelName');
    }

    // Validate domainExpression with Zod before persisting.
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

    const rule = await this.repo.createRecordRule({
      name: input.name.trim(),
      description: input.description?.trim(),
      modelName: input.modelName.trim(),
      groupId: input.groupId,
      mode: input.mode,
      domainExpression: input.domainExpression,
      isActive: input.isActive ?? true,
    });

    this.logger.info('Record rule created', { ruleId: rule.id, modelName: rule.modelName });

    // Resolve groupCode for the event payload (consumers need code, not id).
    let groupCode: string | null = null;
    if (rule.groupId) {
      const group = await this.repo.findGroupById(rule.groupId);
      groupCode = group?.code ?? null;
    }

    // Publish full snapshot event — fire and log on failure (no rollback per CLAUDE.md).
    try {
      await this.publisher.publish({
        eventType: 'rule.created',
        ruleId: rule.id,
        rule: {
          id: rule.id,
          name: rule.name,
          modelName: rule.modelName,
          groupCode,
          mode: rule.mode as 'read' | 'write' | 'create' | 'unlink',
          domainExpression: rule.domainExpression,
          isActive: rule.isActive,
        },
      });
    } catch (err) {
      this.logger.error(
        'Failed to publish record-rule created event — consuming caches may be stale',
        err as Error,
        { ruleId: rule.id, modelName: rule.modelName },
      );
      // Do NOT rethrow — rule is persisted, caches will sync on next TTL refresh.
    }

    return rule;
  }
}
