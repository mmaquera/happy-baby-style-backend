/**
 * Application-layer port for record-rule invalidation events.
 * The infrastructure implementation (RedisRecordRulesEventPublisher) lives in
 * infrastructure/messaging/RecordRulesEventPublisher.ts.
 *
 * This interface is imported by use cases — it keeps the application layer
 * free of Redis/infrastructure concerns.
 */
export type RecordRuleEventType = 'rule.created' | 'rule.updated' | 'rule.deleted';

/**
 * Full rule snapshot embedded in created/updated events so consuming subgraphs
 * can maintain a local in-memory cache (StreamRecordRuleSource) without needing
 * a DB connection to user-service.
 *
 * For rule.deleted events, `rule` is null and only `ruleId` is populated.
 */
export interface RecordRuleEventPayload {
  eventType: RecordRuleEventType;
  /** Always present — used by consumers to upsert or remove from cache. */
  ruleId: string;
  /** Present on created/updated events. null on deleted events. */
  rule: {
    id: string;
    name: string;
    modelName: string;
    groupCode: string | null;
    mode: 'read' | 'write' | 'create' | 'unlink';
    domainExpression: unknown;
    isActive: boolean;
  } | null;
}

export interface IRecordRulesEventPublisher {
  publish(event: RecordRuleEventPayload): Promise<void>;
}
