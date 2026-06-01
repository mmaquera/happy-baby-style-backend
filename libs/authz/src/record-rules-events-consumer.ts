import type Redis from 'ioredis';
import type { ILogger } from '@hbs/logging';
import type { RecordRule, RecordRuleMode, RecordRuleResolver } from './record-rule-resolver';
import type { StreamRecordRuleSource } from './stream-record-rule-source';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecordRulesConsumerOptions {
  /** Redis Stream name. Default: 'stream:record-rules-updated' */
  streamName: string;
  /**
   * Consumer group name — one group per service so all services receive
   * every event independently (N groups = N independent consumers that all
   * see the same events, unlike 1 group where messages are load-balanced).
   * Example: 'product-service-rbac-cg'
   */
  consumerGroup: string;
  /**
   * Per-instance consumer name for tracking in the pending-entries list.
   * Use process.env.HOSTNAME or randomUUID() for uniqueness per replica.
   */
  consumerName: string;
  /** Milliseconds to block waiting for new entries. Default: 5000 */
  blockMs?: number;
  /** Milliseconds before an unacknowledged entry is reclaimed. Default: 60000 */
  autoclaimIdleMs?: number;
}

type StreamEntry = [id: string, fields: string[]];
type StreamReadResponse = [stream: string, entries: StreamEntry[]][] | null;
type AutoClaimResponse = [cursor: string, entries: StreamEntry[], deleted: string[]];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a flat Redis stream fields array `[k1, v1, k2, v2, ...]`
 * into a plain object `{ k1: v1, k2: v2, ... }`.
 */
function fieldsToMap(fields: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 0; i + 1 < fields.length; i += 2) {
    map[fields[i]] = fields[i + 1];
  }
  return map;
}

// ---------------------------------------------------------------------------
// RecordRulesEventsConsumer
// ---------------------------------------------------------------------------

/**
 * Redis Stream consumer that keeps a RecordRuleResolver's in-memory cache
 * in sync with record-rule change events.
 *
 * Two modes of operation (selected at construction time):
 *
 * 1. Without `streamSource` (user-service, PrismaRecordRuleSource):
 *    On each event, calls `resolver.refresh()` which re-queries the database.
 *    Payload fields in the event are ignored — the DB is the source of truth.
 *
 * 2. With `streamSource` (non-owner subgraphs, e.g. order-service):
 *    Parses the rule snapshot from the event payload and drives the
 *    StreamRecordRuleSource directly (upsert/remove), then calls
 *    `resolver.refresh()` to propagate the change into the resolver's cache.
 *    No DB connection to user-service is required.
 *
 * Common design notes:
 *  - Idempotency: cache refresh is naturally idempotent — refreshing N times
 *    is safe. No InboxEvent guard is needed (unlike business event consumers).
 *  - ACK strategy: batch-ACK all entries in a single XACK call after
 *    processing succeeds. On failure, entries remain pending and will be
 *    reclaimed by XAUTOCLAIM on the next iteration.
 *  - Consumer groups: each service MUST use its own consumer group so that
 *    every service independently consumes all events.
 *  - Initial refresh: called during start() so the cache is warm before the
 *    first inbound request.
 */
export class RecordRulesEventsConsumer {
  private running = false;
  private readonly blockMs: number;
  private readonly autoclaimIdleMs: number;

  constructor(
    private readonly redis: Redis,
    private readonly resolver: RecordRuleResolver,
    private readonly logger: ILogger,
    private readonly options: RecordRulesConsumerOptions,
    /**
     * Optional StreamRecordRuleSource for non-owner subgraphs.
     * When provided, event payloads are parsed and applied to the source
     * before resolver.refresh() is called.
     * When absent, resolver.refresh() re-queries the DB (user-service mode).
     */
    private readonly streamSource?: StreamRecordRuleSource,
  ) {
    this.blockMs = options.blockMs ?? 5_000;
    this.autoclaimIdleMs = options.autoclaimIdleMs ?? 60_000;
  }

  /**
   * Ensures the consumer group exists. Catches BUSYGROUP (already exists)
   * so this is safe to call on every boot without error.
   */
  async ensureGroup(): Promise<void> {
    try {
      await this.redis.xgroup(
        'CREATE',
        this.options.streamName,
        this.options.consumerGroup,
        '$',
        'MKSTREAM',
      );
      this.logger.info('Created RBAC consumer group', {
        stream: this.options.streamName,
        group: this.options.consumerGroup,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('BUSYGROUP')) {
        return; // Group already exists — fine
      }
      throw err;
    }
  }

  /**
   * Starts the consumer. Ensures the consumer group, warms the cache with
   * an initial refresh, then launches the event loop in the background.
   *
   * The loop does NOT block server startup — it is fire-and-forget after
   * ensureGroup() and the initial refresh complete.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.ensureGroup();

    // Warm cache on boot so first requests do not hit EmptyRecordRuleSource
    // or PrismaSource cold (which would hit DB synchronously on first query).
    await this.resolver.refresh();

    this.logger.info('RBAC events consumer started', {
      stream: this.options.streamName,
      group: this.options.consumerGroup,
      consumer: this.options.consumerName,
    });

    // Fire-and-forget: errors inside loop() are caught and logged internally.
    this.loop().catch((err: unknown) => {
      this.logger.error('RBAC consumer loop crashed unexpectedly', err as Error);
    });
  }

  /**
   * Signals the consumer loop to stop after the current iteration completes.
   * Call during SIGTERM/SIGINT shutdown.
   */
  async stop(): Promise<void> {
    this.running = false;
  }

  // ---------------------------------------------------------------------------
  // Private loop logic
  // ---------------------------------------------------------------------------

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        // Step 1: Reclaim entries idle for > autoclaimIdleMs from crashed consumers.
        await this.reclaimStale();

        // Step 2: Block-read new entries assigned to this consumer.
        const response = (await this.redis.xreadgroup(
          'GROUP',
          this.options.consumerGroup,
          this.options.consumerName,
          'COUNT',
          '10',
          'BLOCK',
          String(this.blockMs),
          'STREAMS',
          this.options.streamName,
          '>',
        )) as StreamReadResponse;

        if (!response) continue; // BLOCK timeout — no new events, loop again

        await this.handleStreamResponse(response);
      } catch (err: unknown) {
        this.logger.error(
          'RBAC consumer iteration failed — backing off 1s',
          err as Error,
        );
        // Brief backoff to avoid spinning hot on persistent Redis error.
        await new Promise<void>(r => setTimeout(r, 1_000));
      }
    }
  }

  private async reclaimStale(): Promise<void> {
    try {
      const result = (await this.redis.xautoclaim(
        this.options.streamName,
        this.options.consumerGroup,
        this.options.consumerName,
        String(this.autoclaimIdleMs),
        '0',
        'COUNT',
        '10',
      )) as AutoClaimResponse;

      const entries = result?.[1] ?? [];
      if (entries.length > 0) {
        await this.processBatch(entries);
      }
    } catch (err: unknown) {
      // Non-fatal: older Redis versions may not support XAUTOCLAIM.
      this.logger.warn('XAUTOCLAIM failed — skipping reclaim', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async handleStreamResponse(streams: StreamReadResponse): Promise<void> {
    if (!streams) return;
    for (const [, entries] of streams) {
      await this.processBatch(entries);
    }
  }

  /**
   * Processes a batch of stream entries.
   *
   * When a StreamRecordRuleSource is wired in (non-owner subgraph mode):
   *  - Each entry's payload is parsed and applied to the source (upsert/remove).
   *  - resolver.refresh() is called once after all entries are applied.
   *
   * When no StreamRecordRuleSource is present (user-service / DB-backed mode):
   *  - resolver.refresh() re-queries the database once for the whole batch.
   *
   * ACK strategy: all entries are batch-ACKed AFTER successful processing.
   * If an error occurs, entries are NOT acked and stay pending for retry/reclaim.
   */
  private async processBatch(entries: StreamEntry[]): Promise<void> {
    if (entries.length === 0) return;

    if (this.streamSource) {
      // Non-owner subgraph: apply each event's payload to the in-memory source.
      for (const [, fields] of entries) {
        this.applyToStreamSource(fields);
      }
    }

    // Refresh the resolver so resolveWhere() sees the updated rule set.
    // In DB-backed mode this re-queries the DB.
    // In stream-source mode this re-reads from the now-updated Map.
    await this.resolver.refresh();

    const entryIds = entries.map(e => e[0]);
    await this.redis.xack(
      this.options.streamName,
      this.options.consumerGroup,
      ...entryIds,
    );

    this.logger.info('Processed RBAC rule events — cache refreshed', {
      count: entries.length,
      stream: this.options.streamName,
      group: this.options.consumerGroup,
    });
  }

  /**
   * Parses a single stream entry's fields and applies the mutation to the
   * StreamRecordRuleSource.
   *
   * Parsing is best-effort: if the `rule` JSON is malformed or required fields
   * are missing, we log a warning and skip the entry. The resolver's existing
   * cache is not disturbed.
   */
  private applyToStreamSource(fields: string[]): void {
    if (!this.streamSource) return;

    const map = fieldsToMap(fields);
    const { eventType, ruleId } = map;

    if (!eventType || !ruleId) {
      this.logger.warn('Skipping RBAC stream entry — missing eventType or ruleId', { fields });
      return;
    }

    if (eventType === 'rule.deleted') {
      this.streamSource.remove(ruleId);
      this.logger.info('Stream source: removed rule', { ruleId });
      return;
    }

    if (eventType === 'rule.created' || eventType === 'rule.updated') {
      const rawRule = map['rule'];
      if (!rawRule) {
        this.logger.warn('Skipping RBAC stream entry — missing rule payload', {
          eventType,
          ruleId,
        });
        return;
      }

      let parsed: {
        id: string;
        name: string;
        modelName: string;
        groupCode: string | null;
        mode: string;
        domainExpression: unknown;
        isActive: boolean;
      };

      try {
        parsed = JSON.parse(rawRule);
      } catch (err) {
        this.logger.warn('Skipping RBAC stream entry — rule JSON parse failed', {
          eventType,
          ruleId,
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      const rule: RecordRule = {
        id: parsed.id,
        modelName: parsed.modelName,
        groupCode: parsed.groupCode,
        mode: parsed.mode as RecordRuleMode,
        domainExpression: parsed.domainExpression,
        isActive: parsed.isActive,
      };

      this.streamSource.upsert(rule);
      this.logger.info('Stream source: upserted rule', {
        eventType,
        ruleId,
        modelName: rule.modelName,
        mode: rule.mode,
        isActive: rule.isActive,
      });
      return;
    }

    this.logger.warn('Skipping RBAC stream entry — unknown eventType', { eventType, ruleId });
  }
}
