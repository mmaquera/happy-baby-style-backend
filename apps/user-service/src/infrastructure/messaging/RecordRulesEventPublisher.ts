import { randomUUID } from 'crypto';
import type Redis from 'ioredis';
import type { ILogger } from '@hbs/logging';
import type { IRecordRulesEventPublisher, RecordRuleEventPayload } from '../../application/ports/IRecordRulesEventPublisher';

// ---------------------------------------------------------------------------
// Redis Stream implementation
// ---------------------------------------------------------------------------

/**
 * Publishes record-rule change events to a Redis Stream.
 *
 * Stream name is provided via options (env-var driven) to avoid hardcoding.
 * Convention: `stream:record-rules-updated`.
 *
 * Payload shape (Fase 5.8):
 *  - rule.created / rule.updated: carry full rule snapshot in `rule` JSON field.
 *  - rule.deleted: `rule` is omitted; only `ruleId` is present.
 *
 * Consuming subgraphs (StreamRecordRuleSource) upsert/remove from their local
 * in-memory cache based on eventType and the embedded `rule` snapshot.
 *
 * XADD MAXLEN ~ 10000 — mirrors order-service RedisEventPublisher pattern.
 * Every event carries a uuid eventId for downstream idempotency.
 */
export class RedisRecordRulesEventPublisher implements IRecordRulesEventPublisher {
  private readonly streamName: string;
  private readonly maxLen: number;

  constructor(
    private readonly redis: Redis,
    private readonly logger: ILogger,
    options: { streamName: string; maxLen?: number },
  ) {
    this.streamName = options.streamName;
    this.maxLen = options.maxLen ?? 10_000;
  }

  async publish(input: RecordRuleEventPayload): Promise<void> {
    const eventId = randomUUID();
    const emittedAt = new Date().toISOString();

    // Build flat key-value pairs for XADD.
    // Redis stream fields must be strings; `rule` snapshot is JSON-encoded.
    const fields: string[] = [
      'eventId', eventId,
      'eventType', input.eventType,
      'ruleId', input.ruleId,
      'emittedAt', emittedAt,
    ];

    if (input.rule !== null) {
      fields.push('rule', JSON.stringify(input.rule));
    }

    try {
      const entryId = await this.redis.xadd(
        this.streamName,
        'MAXLEN',
        '~',
        String(this.maxLen),
        '*',
        ...fields,
      );

      this.logger.info('Published record-rule event', {
        entryId,
        eventId,
        eventType: input.eventType,
        ruleId: input.ruleId,
        hasRulePayload: input.rule !== null,
        stream: this.streamName,
      });
    } catch (err) {
      // Log as error — the cache in consuming subgraphs will NOT be invalidated.
      // Needs alerting/reconciliation: stale rules may grant or deny access incorrectly.
      this.logger.error(
        'Failed to publish record-rule event — cache invalidation may be stale',
        err as Error,
        { eventId, eventType: input.eventType, ruleId: input.ruleId },
      );
      throw err;
    }
  }
}
