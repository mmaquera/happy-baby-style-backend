import type { PrismaClient } from '@prisma/client';
import { LoggerFactory } from '@hbs/logging';
import type { ILogger } from '@hbs/logging';
import type { IRecordRuleSource, RecordRule, RecordRuleMode } from '@hbs/authz';

/**
 * Loads all active AuthRecordRule rows from the database, joining group codes.
 *
 * Implements the IRecordRuleSource port from @hbs/authz.
 * Used by RecordRuleResolver to populate its in-memory cache.
 */
export class PrismaRecordRuleSource implements IRecordRuleSource {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaRecordRuleSource');
  }

  async loadAllActive(): Promise<RecordRule[]> {
    this.logger.info('Loading all active record rules from database');

    const rows = await this.prisma.authRecordRule.findMany({
      where: { isActive: true },
      include: {
        group: {
          select: { code: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const rules: RecordRule[] = rows.map(r => ({
      id: r.id,
      modelName: r.modelName,
      groupCode: r.group?.code ?? null,
      mode: r.mode as RecordRuleMode,
      domainExpression: r.domainExpression,
      isActive: r.isActive,
    }));

    this.logger.info('Loaded record rules', { count: rules.length });

    return rules;
  }
}
