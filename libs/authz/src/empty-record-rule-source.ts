import type { IRecordRuleSource, RecordRule } from './record-rule-resolver';

/**
 * Temporary IRecordRuleSource implementation for subgraphs that do NOT have
 * direct access to the user-service database.
 *
 * Semantics: always returns an empty rule list. When RecordRuleResolver sees
 * no rules for a given (modelName, mode), it returns `{}` — no restriction
 * applied. This is correct and safe for the current phase because no
 * record-level rules have been created yet (admin CRUD mutations land in Fase 5.10).
 *
 * TODO Fase 5.10: replace this with a hydrated source that fetches all active
 * rules from user-service on boot (HTTP/gRPC call once) and then invalidates
 * via the stream:record-rules-updated consumer. Options evaluated:
 *   - Option B: stream events carry the full rule list snapshot (autonomous subgraphs)
 *   - Option C: stream event triggers lazy HTTP fetch to user-service
 *   - Option D: boot-time HTTP fetch + stream invalidation triggers re-fetch
 * Decision deferred to Fase 5.10 when the admin mutation surface is defined.
 *
 * @see [[record-rule-resolver]] IRecordRuleSource
 */
export class EmptyRecordRuleSource implements IRecordRuleSource {
  async loadAllActive(): Promise<RecordRule[]> {
    return [];
  }
}
