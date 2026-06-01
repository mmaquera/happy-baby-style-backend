import type { IRecordRuleSource, RecordRule } from './record-rule-resolver';

/**
 * In-memory record rule source maintained by the Redis Stream consumer.
 *
 * Subgraphs that do not own the record_rules table use this instead of
 * PrismaRecordRuleSource. The RecordRulesEventsConsumer upserts/removes rules
 * as events arrive from stream:record-rules-updated.
 *
 * Lifecycle:
 *  - At boot: empty — snapshot-on-boot is deferred.
 *    TODO (Fase futura): on startup, fetch a snapshot from user-service via HTTP
 *    (Option D) so rules created while the subgraph was offline are not missed.
 *  - On 'rule.created' / 'rule.updated' events: upsert by rule.id.
 *  - On 'rule.deleted' events: remove by ruleId.
 *
 * Thread-safety: Node.js single-threaded execution guarantees no concurrent
 * mutations — stream consumer processes one batch at a time.
 *
 * Known limitation (pilot): if admin creates a rule while this subgraph is
 * down, the rule is NOT visible until a subsequent update/create event arrives
 * for the same rule after boot. This is acceptable for the Fase 5.8 pilot.
 */
export class StreamRecordRuleSource implements IRecordRuleSource {
  private readonly rules = new Map<string, RecordRule>();

  /**
   * Adds or replaces a rule in the in-memory cache.
   * Called by RecordRulesEventsConsumer on rule.created and rule.updated events.
   */
  upsert(rule: RecordRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Removes a rule from the in-memory cache by its id.
   * Called by RecordRulesEventsConsumer on rule.deleted events.
   */
  remove(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Returns all currently active rules in the cache.
   * RecordRuleResolver calls this on refresh().
   */
  async loadAllActive(): Promise<RecordRule[]> {
    return Array.from(this.rules.values()).filter(r => r.isActive);
  }
}
