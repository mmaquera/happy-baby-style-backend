/**
 * Tests for RecordRulesEventsConsumer.
 *
 * Testing strategy:
 *   We test the individual methods (ensureGroup, processBatch, reclaimStale)
 *   by calling the consumer's public API and using spies on the private loop
 *   to prevent it from actually spinning. The infinite event loop is tested
 *   only at the unit level (it calls autoclaim + xreadgroup). Integration with
 *   a live Redis instance is out-of-scope per project testing standards.
 */

import { RecordRulesEventsConsumer } from '../record-rules-events-consumer';
import type { RecordRulesConsumerOptions } from '../record-rules-events-consumer';

// ---------------------------------------------------------------------------
// Required mock: @hbs/logging must be virtual-mocked.
// ---------------------------------------------------------------------------

jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        fatal: jest.fn(),
        child: jest.fn(),
        setTraceId: jest.fn(),
      }),
    }),
  },
}), { virtual: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockLogger() {
  const logger: any = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
    setTraceId: jest.fn(),
  };
  logger.child = jest.fn().mockReturnValue(logger);
  return logger;
}

function makeMockResolver() {
  return {
    refresh: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeMockRedis() {
  return {
    xgroup: jest.fn().mockResolvedValue('OK'),
    xreadgroup: jest.fn().mockResolvedValue(null),
    xack: jest.fn().mockResolvedValue(1),
    xautoclaim: jest.fn().mockResolvedValue(['0', [], []]),
  } as any;
}

function makeOptions(overrides?: Partial<RecordRulesConsumerOptions>): RecordRulesConsumerOptions {
  return {
    streamName: 'stream:record-rules-updated',
    consumerGroup: 'test-service-rbac-cg',
    consumerName: 'test-consumer-1',
    blockMs: 5_000,
    autoclaimIdleMs: 60_000,
    ...overrides,
  };
}

/**
 * Creates a consumer with the internal `loop()` stubbed to a no-op so the
 * while(running) cycle never executes in tests. This lets us test
 * start() / stop() / ensureGroup() without spinning the event loop.
 */
function makeConsumerWithStubbedLoop(
  redis: any,
  resolver: any,
  logger: any,
  options?: Partial<RecordRulesConsumerOptions>,
): RecordRulesEventsConsumer {
  const consumer = new RecordRulesEventsConsumer(
    redis,
    resolver,
    logger,
    makeOptions(options),
  ) as any;
  // Replace the private loop with a no-op so it doesn't spin in tests.
  consumer.loop = jest.fn().mockResolvedValue(undefined);
  return consumer as RecordRulesEventsConsumer;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecordRulesEventsConsumer', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---- ensureGroup --------------------------------------------------------

  describe('ensureGroup()', () => {
    it('creates the consumer group via XGROUP CREATE MKSTREAM', async () => {
      const redis = makeMockRedis();
      const consumer = makeConsumerWithStubbedLoop(redis, makeMockResolver(), makeMockLogger());

      await consumer.ensureGroup();

      expect(redis.xgroup).toHaveBeenCalledWith(
        'CREATE',
        'stream:record-rules-updated',
        'test-service-rbac-cg',
        '$',
        'MKSTREAM',
      );
    });

    it('swallows BUSYGROUP error — idempotent when group already exists', async () => {
      const redis = makeMockRedis();
      redis.xgroup.mockRejectedValueOnce(
        new Error('BUSYGROUP Consumer Group name already exists'),
      );
      const consumer = makeConsumerWithStubbedLoop(redis, makeMockResolver(), makeMockLogger());

      await expect(consumer.ensureGroup()).resolves.toBeUndefined();
    });

    it('rethrows non-BUSYGROUP errors from XGROUP', async () => {
      const redis = makeMockRedis();
      redis.xgroup.mockRejectedValueOnce(
        new Error('WRONGTYPE Operation against a key holding the wrong kind of value'),
      );
      const consumer = makeConsumerWithStubbedLoop(redis, makeMockResolver(), makeMockLogger());

      await expect(consumer.ensureGroup()).rejects.toThrow('WRONGTYPE');
    });
  });

  // ---- start() ------------------------------------------------------------

  describe('start()', () => {
    it('calls ensureGroup + resolver.refresh() to warm cache on startup', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      const consumer = makeConsumerWithStubbedLoop(redis, resolver, makeMockLogger());

      await consumer.start();

      expect(redis.xgroup).toHaveBeenCalledTimes(1);
      expect(resolver.refresh).toHaveBeenCalledTimes(1);
    });

    it('launches the background loop', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      const consumer = makeConsumerWithStubbedLoop(redis, resolver, makeMockLogger());

      await consumer.start();

      expect((consumer as any).loop).toHaveBeenCalledTimes(1);
    });

    it('is idempotent — calling start() twice does not double-init', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      const consumer = makeConsumerWithStubbedLoop(redis, resolver, makeMockLogger());

      await consumer.start();
      await consumer.start(); // no-op: running=true

      expect(redis.xgroup).toHaveBeenCalledTimes(1);
      expect(resolver.refresh).toHaveBeenCalledTimes(1);
      expect((consumer as any).loop).toHaveBeenCalledTimes(1);
    });
  });

  // ---- stop() -------------------------------------------------------------

  describe('stop()', () => {
    it('resolves and sets running=false', async () => {
      const consumer = makeConsumerWithStubbedLoop(makeMockRedis(), makeMockResolver(), makeMockLogger());

      await consumer.start();
      await expect(consumer.stop()).resolves.toBeUndefined();

      expect((consumer as any).running).toBe(false);
    });

    it('calling stop() before start() is a no-op', async () => {
      const redis = makeMockRedis();
      const consumer = makeConsumerWithStubbedLoop(redis, makeMockResolver(), makeMockLogger());

      await expect(consumer.stop()).resolves.toBeUndefined();
      expect(redis.xgroup).not.toHaveBeenCalled();
    });
  });

  // ---- processBatch (via private accessor) --------------------------------

  describe('processBatch (internal)', () => {
    it('calls resolver.refresh() once and batch-xacks all entry IDs', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      const consumer = makeConsumerWithStubbedLoop(redis, resolver, makeMockLogger()) as any;

      const entries: Array<[string, string[]]> = [
        ['1717000000000-0', ['eventId', 'uuid-1', 'type', 'rule.created']],
        ['1717000000001-0', ['eventId', 'uuid-2', 'type', 'rule.updated']],
      ];

      await consumer.processBatch(entries);

      expect(resolver.refresh).toHaveBeenCalledTimes(1);
      expect(redis.xack).toHaveBeenCalledWith(
        'stream:record-rules-updated',
        'test-service-rbac-cg',
        '1717000000000-0',
        '1717000000001-0',
      );
    });

    it('is a no-op when entries array is empty', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      const consumer = makeConsumerWithStubbedLoop(redis, resolver, makeMockLogger()) as any;

      await consumer.processBatch([]);

      expect(resolver.refresh).not.toHaveBeenCalled();
      expect(redis.xack).not.toHaveBeenCalled();
    });

    it('does NOT xack if resolver.refresh() throws — entries stay pending for retry', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      resolver.refresh.mockRejectedValueOnce(new Error('source unavailable'));
      const consumer = makeConsumerWithStubbedLoop(redis, resolver, makeMockLogger()) as any;

      const entries: Array<[string, string[]]> = [
        ['1717000000000-0', ['eventId', 'uuid-fail']],
      ];

      await expect(consumer.processBatch(entries)).rejects.toThrow('source unavailable');
      expect(redis.xack).not.toHaveBeenCalled();
    });
  });

  // ---- reclaimStale (via private accessor) --------------------------------

  describe('reclaimStale (internal)', () => {
    it('calls processBatch for reclaimed entries', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      const reclaimedEntries: Array<[string, string[]]> = [
        ['1717000000000-0', ['eventId', 'uuid-stale', 'type', 'rule.deleted']],
      ];
      redis.xautoclaim.mockResolvedValueOnce(['0', reclaimedEntries, []]);

      const consumer = makeConsumerWithStubbedLoop(redis, resolver, makeMockLogger()) as any;

      await consumer.reclaimStale();

      expect(resolver.refresh).toHaveBeenCalledTimes(1);
      expect(redis.xack).toHaveBeenCalledWith(
        'stream:record-rules-updated',
        'test-service-rbac-cg',
        '1717000000000-0',
      );
    });

    it('logs warn but does not throw when XAUTOCLAIM fails (older Redis)', async () => {
      const redis = makeMockRedis();
      redis.xautoclaim.mockRejectedValueOnce(new Error('ERR unknown command xautoclaim'));
      const logger = makeMockLogger();
      const consumer = makeConsumerWithStubbedLoop(redis, makeMockResolver(), logger) as any;

      await expect(consumer.reclaimStale()).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith(
        'XAUTOCLAIM failed — skipping reclaim',
        expect.objectContaining({ error: expect.stringContaining('ERR unknown command') }),
      );
    });

    it('is a no-op when XAUTOCLAIM returns empty entries', async () => {
      const redis = makeMockRedis();
      // Default mock already returns empty entries
      const resolver = makeMockResolver();
      const consumer = makeConsumerWithStubbedLoop(redis, resolver, makeMockLogger()) as any;

      await consumer.reclaimStale();

      expect(resolver.refresh).not.toHaveBeenCalled();
      expect(redis.xack).not.toHaveBeenCalled();
    });
  });
});
