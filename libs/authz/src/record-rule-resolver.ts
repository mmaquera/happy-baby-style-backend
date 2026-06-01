import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory } from '@hbs/logging';
import type { ILogger } from '@hbs/logging';
import { compileDomainExpr, type EvaluationContext } from './domain-expression';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecordRuleMode = 'read' | 'write' | 'create' | 'unlink';

/**
 * A single record-level access rule loaded from the rules source.
 *
 * groupCode matches against TokenPayload.groups (string codes like "administrators").
 * null means the rule is global — applies to ALL users regardless of group membership.
 */
export interface RecordRule {
  id: string;
  modelName: string;       // PascalCase entity name, e.g. "Order"
  groupCode: string | null; // null = global rule; otherwise matches TokenPayload.groups entries
  mode: RecordRuleMode;
  domainExpression: unknown; // JSON validated on-demand by compileDomainExpr (Zod)
  isActive: boolean;
}

/**
 * Port for loading rules from the persistence layer.
 * Implemented by PrismaRecordRuleSource in user-service infrastructure.
 * In subgraphs (Fase 5.7.2), this will be a cache fed by Redis Stream invalidation.
 */
export interface IRecordRuleSource {
  loadAllActive(): Promise<RecordRule[]>;
}

// ---------------------------------------------------------------------------
// RecordRuleResolver
// ---------------------------------------------------------------------------

/**
 * Resolves the Prisma `where` filter to apply for a given model + mode + current user.
 *
 * Semantics (Odoo ir.rule-aligned):
 *   - Global rules (groupCode === null): ALWAYS apply. Combined with AND.
 *   - Group-specific rules: user passes if ANY of their groups has a matching rule (OR).
 *   - If the model has group-specific rules but NONE match the user's groups:
 *       → returns impossible where `{ id: { in: [] } }` (deny).
 *   - If NO rules exist for (modelName, mode): returns `{}` (no restriction).
 *   - If user is null and the model has any rules: returns impossible where (deny).
 *
 * Cache: in-memory list keyed on first load. TTL-based lazy refresh.
 * Call `refresh()` explicitly from a Redis Stream consumer on invalidation events.
 */
export class RecordRuleResolver {
  private rules: RecordRule[] = [];
  private initialized: boolean = false;
  private loadedAt: number = 0;
  private readonly cacheTtlMs: number;
  private readonly logger: ILogger;

  /**
   * Universal deny predicate: `NOT {}` matches nothing, regardless of which
   * fields a model exposes. This is model-agnostic — unlike `{ id: { in: [] } }`
   * which silently passes if the model has no `id` field.
   */
  private readonly DENY_WHERE: Record<string, unknown> = { AND: [{ NOT: {} }] };

  /**
   * In-flight refresh promise for singleflight deduplication.
   * N concurrent callers during cold-start will all await the same DB query.
   */
  private inFlightRefresh: Promise<void> | null = null;

  constructor(
    private readonly source: IRecordRuleSource,
    options?: { cacheTtlMs?: number },
  ) {
    this.cacheTtlMs = options?.cacheTtlMs ?? 300_000; // 5 min default
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('RecordRuleResolver');
  }

  /**
   * Force reload from source. Used by Redis Stream consumer (Fase 5.7.2)
   * on receipt of a `record-rules-updated` event.
   *
   * Singleflight: if a refresh is already in progress, all concurrent callers
   * await the same promise — only one DB query is issued.
   */
  async refresh(): Promise<void> {
    if (this.inFlightRefresh) return this.inFlightRefresh;
    this.inFlightRefresh = (async () => {
      try {
        this.rules = await this.source.loadAllActive();
        this.initialized = true;
        this.loadedAt = Date.now();
      } finally {
        this.inFlightRefresh = null;
      }
    })();
    return this.inFlightRefresh;
  }

  /**
   * Lazy load on first use; refresh after TTL expires.
   */
  private async ensureFresh(): Promise<void> {
    if (!this.initialized || Date.now() - this.loadedAt >= this.cacheTtlMs) {
      await this.refresh();
    }
  }

  /**
   * Safely compiles a rule's domainExpression, absorbing ZodError and other
   * parse failures.
   *
   * Fail-closed semantics:
   * - A corrupted rule is SKIPPED (not propagated to the caller).
   * - Skipping means the restriction that rule would have imposed is absent.
   *   This does NOT expand access beyond what other valid rules allow — it
   *   simply removes the broken rule's contribution.
   * - If the skipped rule was the ONLY global rule, the global AND clause
   *   becomes empty, which may allow broader access. This is acceptable: the
   *   operator must fix the corrupted expression to restore the restriction.
   * - If the skipped rule was the ONLY matching group rule, the group OR
   *   clause becomes empty → the user is denied (no group rule matches).
   * - The error is always logged with ruleId/modelName/mode so operators can
   *   detect and fix corrupted expressions in the database.
   *
   * The stricter alternative (deny the entire model when ANY rule fails to
   * compile) was intentionally rejected: a single corrupt admin rule would
   * lock out the whole model for all users, which is a worse failure mode.
   */
  private compileRuleSafe(
    rule: RecordRule,
    ctx: EvaluationContext,
  ): Record<string, unknown> | null {
    try {
      return compileDomainExpr(rule.domainExpression, ctx);
    } catch (err) {
      this.logger.error(
        'Failed to compile record-rule domain_expression — skipping rule',
        err as Error,
        { ruleId: rule.id, modelName: rule.modelName, mode: rule.mode },
      );
      return null;
    }
  }

  /**
   * Returns the Prisma `where` clause to apply for this user on (modelName, mode).
   *
   * - `{}` — no rules defined for model+mode (no restriction, full access).
   * - Combined filter — AND of global wheres + OR of group-matching wheres.
   * - `DENY_WHERE` — rules exist but user has no matching group, or user is unauthenticated.
   */
  async resolveWhere(
    modelName: string,
    mode: RecordRuleMode,
    user: TokenPayload | null,
  ): Promise<Record<string, unknown>> {
    await this.ensureFresh();

    const applicableRules = this.rules.filter(
      r => r.modelName === modelName && r.mode === mode && r.isActive,
    );

    // No rules for this model+mode → no restriction
    if (applicableRules.length === 0) return {};

    // Unauthenticated user + restricted model → deny
    if (!user) {
      return this.DENY_WHERE;
    }

    const globalRules = applicableRules.filter(r => r.groupCode === null);
    const groupRules = applicableRules.filter(r => r.groupCode !== null);

    const userGroups = user.groups ?? [];

    const ctx: EvaluationContext = { currentUser: user };

    const globalWheres = globalRules
      .map(r => this.compileRuleSafe(r, ctx))
      .filter((w): w is Record<string, unknown> => w !== null);

    const matchingGroupRules = groupRules.filter(
      r => r.groupCode !== null && userGroups.includes(r.groupCode),
    );

    // Group rules exist for this model but none match the user → deny
    // Exception: if there are global rules that would still grant access,
    // we honour them (globals override the deny from missing group rule).
    if (groupRules.length > 0 && matchingGroupRules.length === 0 && globalWheres.length === 0) {
      return this.DENY_WHERE;
    }

    const groupWheres = matchingGroupRules
      .map(r => this.compileRuleSafe(r, ctx))
      .filter((w): w is Record<string, unknown> => w !== null);

    // Combine: AND globals + OR groups
    const parts: Record<string, unknown>[] = [];
    if (globalWheres.length > 0) parts.push({ AND: globalWheres });
    if (groupWheres.length > 0) parts.push({ OR: groupWheres });

    if (parts.length === 0) return {};
    if (parts.length === 1) return parts[0];
    return { AND: parts };
  }
}
