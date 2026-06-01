import type { RecordRule } from './record-rule-resolver';
import type { StreamRecordRuleSource } from './stream-record-rule-source';
import type { ILogger } from '@hbs/logging';

export interface SnapshotFetcherOptions {
  /** Base URL of user-service internal endpoint, e.g. "http://user-service:3006" */
  userServiceUrl: string;
  /** Timeout in ms for the HTTP request. Default 5000. */
  timeoutMs?: number;
  /** Retry attempts on failure. Default 3. */
  maxRetries?: number;
}

/**
 * Fetches snapshot of active record rules from user-service and populates the StreamRecordRuleSource.
 * Should be called at boot before starting RecordRulesEventsConsumer.
 *
 * Behavior on failure:
 * - Logs error.
 * - Retries with exponential backoff (1s, 2s, 3s).
 * - After maxRetries: returns false (caller decides to continue with empty source or hard-fail).
 *   Recommendation: don't hard-fail — the consumer will fill the cache as events arrive,
 *   plus the resolver has TTL refresh as backup.
 */
export async function fetchSnapshotAndPopulate(
  source: StreamRecordRuleSource,
  logger: ILogger,
  options: SnapshotFetcherOptions,
): Promise<{ success: boolean; rulesLoaded: number }> {
  const url = `${options.userServiceUrl}/internal/record-rules`;
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxRetries = options.maxRetries ?? 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const body = (await response.json()) as { rules: RecordRule[] };
      const rules = body.rules ?? [];

      for (const rule of rules) {
        source.upsert(rule);
      }

      logger.info('Snapshot fetched and applied to StreamRecordRuleSource', {
        count: rules.length,
        url,
        attempt,
      });

      return { success: true, rulesLoaded: rules.length };
    } catch (err) {
      logger.warn('Snapshot fetch attempt failed', {
        attempt,
        maxRetries,
        url,
        error: (err as Error).message,
      });

      if (attempt < maxRetries) {
        await new Promise<void>(r => setTimeout(r, 1000 * attempt)); // backoff: 1s, 2s, 3s
      }
    }
  }

  logger.error(
    'Snapshot fetch failed after all retries — proceeding with empty source. Cache will fill from stream events + TTL refresh.',
    new Error('snapshot_unavailable'),
    { url },
  );

  return { success: false, rulesLoaded: 0 };
}
